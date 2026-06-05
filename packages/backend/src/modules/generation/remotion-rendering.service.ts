import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { TransitionConfig, VideoEditProject, VideoSegmentResult } from '@aigc/shared-types';

interface RenderInput {
  taskId: string;
  segments: VideoSegmentResult[];
  resolution: string;
  transition?: TransitionConfig;
  editProject?: VideoEditProject;
}

interface RenderResult {
  video_url: string;
  file_size: number;
}

type RenderSegmentPlan = VideoSegmentResult & {
  trim_start_seconds?: number;
  trim_end_seconds?: number;
};

@Injectable()
export class RemotionRenderingService {
  private readonly logger = new Logger(RemotionRenderingService.name);

  constructor(private readonly configService: ConfigService) {}

  async render(input: RenderInput): Promise<RenderResult> {
    const segments = this.resolveSegments(input.segments, input.editProject);
    if (segments.length < 2) {
      throw new Error('At least two succeeded video segments are required for Remotion transitions');
    }
    const transitions = this.resolveTransitions(input.editProject, input.transition);

    const outputDir = this.getOutputDir();
    const workDir = join(outputDir, `${input.taskId}-remotion-${randomUUID()}`);
    const inputPath = join(workDir, 'input.json');
    const outputPath = this.getOutputPath(input.taskId);

    await mkdir(workDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    try {
      await writeFile(
        inputPath,
        JSON.stringify(
          {
            task_id: input.taskId,
            resolution: input.resolution,
            fps: 30,
            transition: this.normalizeTransition(input.transition),
            transitions,
            segments: segments.map((segment, index) => ({
              index,
              video_url: this.normalizeMediaUrl(segment.video_url),
              duration: segment.duration,
              resolution: segment.resolution,
              aspect_ratio: segment.aspect_ratio,
              trim_start_seconds: segment.trim_start_seconds,
              trim_end_seconds: segment.trim_end_seconds,
            })),
          },
          null,
          2,
        ),
        'utf8',
      );

      await this.runRenderer(inputPath, outputPath);
      const outputStat = await stat(outputPath);
      this.logger.log(`Remotion rendered task=${input.taskId} to ${outputPath} (${outputStat.size} bytes)`);
      return {
        video_url: `/uploads/generated/${input.taskId}-remotion.mp4`,
        file_size: outputStat.size,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private getRenderableSegments(segments: VideoSegmentResult[]) {
    return [...segments]
      .filter((segment) => segment.status !== 'failed' && Boolean(segment.video_url))
      .sort((a, b) => a.index - b.index);
  }

  private resolveSegments(segments: VideoSegmentResult[], editProject?: VideoEditProject): RenderSegmentPlan[] {
    const renderableSegments = this.getRenderableSegments(segments);
    if (!editProject) return renderableSegments;
    if (!editProject.clips.length) throw new Error('Timeline requires at least one clip');

    const byIndex = new Map(renderableSegments.map((segment) => [segment.index, segment]));
    return editProject.clips.map((clip) => {
      const segment = byIndex.get(clip.segment_index);
      if (!segment) throw new Error(`Timeline clip references missing segment ${clip.segment_index + 1}`);
      if (clip.start_seconds < 0 || clip.end_seconds <= clip.start_seconds || clip.end_seconds > segment.duration) {
        throw new Error(`Timeline clip ${clip.id} has an invalid trim range`);
      }
      return {
        ...segment,
        trim_start_seconds: clip.start_seconds,
        trim_end_seconds: clip.end_seconds,
        duration: clip.end_seconds - clip.start_seconds,
      };
    });
  }

  private resolveTransitions(editProject?: VideoEditProject, fallback?: TransitionConfig) {
    if (!editProject) return undefined;
    return editProject.clips.slice(0, -1).map((clip, index) => {
      const nextClip = editProject.clips[index + 1];
      const transition = editProject.transitions.find(
        (item) => item.from_clip_id === clip.id && item.to_clip_id === nextClip.id,
      );
      return this.normalizeTransition(transition ?? fallback);
    });
  }

  private normalizeTransition(transition?: TransitionConfig): Required<TransitionConfig> {
    return {
      type: transition?.type ?? 'fade',
      duration_frames: Math.min(Math.max(Math.round(transition?.duration_frames ?? 12), 6), 30),
    };
  }

  private normalizeMediaUrl(videoUrl: string) {
    if (!videoUrl.startsWith('/uploads/')) return videoUrl;

    const publicBaseUrl =
      this.configService.get<string>('PUBLIC_BASE_URL') ??
      this.configService.get<string>('APP_BASE_URL') ??
      process.env.PUBLIC_BASE_URL ??
      process.env.APP_BASE_URL ??
      'http://localhost:3000';
    return `${publicBaseUrl.replace(/\/$/, '')}${videoUrl}`;
  }

  private getOutputDir() {
    const storage = this.configService.get('storage') as { localPath?: string } | undefined;
    const uploadRoot = storage?.localPath ?? join(process.cwd(), 'uploads');
    return join(uploadRoot, 'generated');
  }

  private getOutputPath(taskId: string) {
    return join(this.getOutputDir(), `${taskId}-remotion.mp4`);
  }

  private runRenderer(inputPath: string, outputPath: string) {
    return new Promise<void>((resolvePromise, reject) => {
      const renderArgs = ['--filter', '@aigc/video-renderer', 'render', '--', '--input', inputPath, '--output', outputPath];
      const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
      const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm', ...renderArgs] : renderArgs;
      const workspaceRoot = this.findWorkspaceRoot();
      this.logger.log(`Starting Remotion render with input=${inputPath}, output=${outputPath}`);
      const child = spawn(command, args, {
        cwd: workspaceRoot,
        windowsHide: true,
      });
      const stderr: string[] = [];
      const stdout: string[] = [];

      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk.toString()));
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('error', (error) => reject(new Error(`Remotion renderer not available: ${error.message}`)));
      child.on('close', (code) => {
        if (code === 0) {
          const output = stdout.join('').trim();
          if (output) this.logger.log(output);
          resolvePromise();
          return;
        }

        const detail = [stderr.join('').trim(), stdout.join('').trim()].filter(Boolean).join('\n');
        reject(new Error(`Remotion renderer exited with code ${code}${detail ? `: ${detail}` : ''}`));
      });
    });
  }

  private findWorkspaceRoot() {
    let current = process.cwd();
    for (let depth = 0; depth < 6; depth += 1) {
      if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
      const parent = dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
    return process.cwd();
  }
}

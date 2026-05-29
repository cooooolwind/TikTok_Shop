import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { VideoSegmentResult } from '@aigc/shared-types';

interface StitchInput {
  taskId: string;
  segments: Pick<VideoSegmentResult, 'index' | 'video_url'>[];
}

interface StitchResult {
  video_url: string;
  file_size: number;
}

@Injectable()
export class VideoStitchingService {
  constructor(private readonly configService: ConfigService) {}

  async hasGeneratedVideo(taskId: string) {
    try {
      await stat(this.getOutputPath(taskId));
      return true;
    } catch {
      return false;
    }
  }

  async stitch(input: StitchInput): Promise<StitchResult> {
    if (input.segments.length < 2) {
      throw new Error('At least two video segments are required for stitching');
    }

    const outputDir = this.getOutputDir();
    const workDir = join(outputDir, `${input.taskId}-${randomUUID()}`);
    const outputPath = this.getOutputPath(input.taskId);
    const concatPath = join(workDir, 'concat.txt');

    await mkdir(workDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    try {
      const localSegments = await Promise.all(
        [...input.segments]
          .sort((a, b) => a.index - b.index)
          .map(async (segment) => this.downloadSegment(segment.video_url, workDir, segment.index)),
      );

      await writeFile(concatPath, this.buildConcatList(localSegments), 'utf8');
      await this.runFfmpeg(concatPath, outputPath);

      const outputStat = await stat(outputPath);
      return {
        video_url: `/uploads/generated/${input.taskId}.mp4`,
        file_size: outputStat.size,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async downloadSegment(videoUrl: string, workDir: string, index: number) {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video segment ${index + 1}: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const segmentPath = join(workDir, `segment-${String(index).padStart(3, '0')}.mp4`);
    await writeFile(segmentPath, buffer);
    return segmentPath;
  }

  private getOutputDir() {
    const storage = this.configService.get('storage') as { localPath?: string } | undefined;
    const uploadRoot = storage?.localPath ?? join(process.cwd(), 'uploads');
    return join(uploadRoot, 'generated');
  }

  private getOutputPath(taskId: string) {
    return join(this.getOutputDir(), `${taskId}.mp4`);
  }

  private buildConcatList(segmentPaths: string[]) {
    return segmentPaths.map((segmentPath) => `file '${this.escapeConcatPath(segmentPath)}'`).join('\n');
  }

  private escapeConcatPath(segmentPath: string) {
    return segmentPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
  }

  private runFfmpeg(concatPath: string, outputPath: string) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.resolveFfmpegPath(),
        ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', outputPath],
        { windowsHide: true },
      );
      const stderr: string[] = [];

      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('error', (error) => reject(new Error(`ffmpeg not available: ${error.message}`)));
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        const detail = stderr.join('').trim();
        reject(new Error(`ffmpeg exited with code ${code}${detail ? `: ${detail}` : ''}`));
      });
    });
  }

  private resolveFfmpegPath() {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

    if (process.platform === 'win32') {
      return join(
        homedir(),
        'AppData',
        'Local',
        'Microsoft',
        'WinGet',
        'Packages',
        'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'ffmpeg-8.1.1-full_build',
        'bin',
        'ffmpeg.exe',
      );
    }

    return 'ffmpeg';
  }
}

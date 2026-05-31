import { Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

export class VideoUtil {
  private static readonly logger = new Logger(VideoUtil.name);

  /**
   * Extract a frame from a video at a specific timestamp and return its Buffer.
   */
  static async extractFrameAt(videoPath: string, timestamp: number): Promise<Buffer> {
    const outputPath = `${videoPath}.${timestamp}.jpg`;
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        '-f', 'image2',
        '-y',
        outputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            const buffer = await fs.readFile(outputPath);
            await fs.unlink(outputPath); 
            resolve(buffer);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            reject(new Error(`Failed to read extracted frame at ${timestamp}: ${errorMessage}`));
          }
        } else {
          this.logger.error(`FFmpeg extraction at ${timestamp} failed with code ${code}: ${stderr}`);
          reject(new Error(`FFmpeg failed to extract frame`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }
}

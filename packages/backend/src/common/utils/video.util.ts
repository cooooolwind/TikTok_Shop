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

  /**
   * Transcode and compress video to a web-compatible format.
   */
  static async transcode(
    inputPath: string,
    outputPath: string,
    options: {
      bitrateThresholdKbps?: number;
      targetCrf?: number;
    } = {},
  ): Promise<{ compressed: boolean }> {
    const { bitrateThresholdKbps = 6000, targetCrf = 23 } = options;

    // 1. Get current metadata
    const metadata = await this.getMetadata(inputPath);
    const currentBitrateKbps = (metadata.size * 8) / (metadata.duration * 1024);
    const needsCompression = currentBitrateKbps > bitrateThresholdKbps;

    return new Promise((resolve, reject) => {
      // ffmpeg args:
      // -y: overwrite output
      // -c:v libx264: use h264
      // -pix_fmt yuv420p: Ensure web compatibility
      // -crf: Constant Rate Factor (18-28 is good, 23 is default)
      // -preset medium: balance between speed and compression
      // -movflags +faststart: Move moov atom to start for faster web playback
      const args = [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        needsCompression ? targetCrf.toString() : '20',
        '-preset',
        'medium',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => (stderr += data.toString()));

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve({ compressed: needsCompression });
        } else {
          this.logger.error(`FFmpeg transcoding failed with code ${code}: ${stderr}`);
          reject(new Error(`FFmpeg failed to transcode video`));
        }
      });
    });
  }

  static async getMetadata(videoPath: string): Promise<{ duration: number; size: number }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size',
        '-of',
        'json',
        videoPath,
      ]);

      let stdout = '';
      ffprobe.stdout.on('data', (data) => (stdout += data.toString()));
      ffprobe.on('close', (code) => {
        if (code === 0) {
          const data = JSON.parse(stdout);
          resolve({
            duration: parseFloat(data.format.duration),
            size: parseInt(data.format.size, 10),
          });
        } else {
          reject(new Error('ffprobe failed to get metadata'));
        }
      });
    });
  }
}

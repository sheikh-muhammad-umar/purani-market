import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

export interface ProcessedVideo {
  compressedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  duration: number; // seconds
  width: number;
  height: number;
}

@Injectable()
export class ShortsVideoService {
  private readonly logger = new Logger(ShortsVideoService.name);
  private readonly MAX_DURATION = 60; // seconds

  /**
   * Process a short video:
   * 1. Validate duration (max 60s)
   * 2. Compress to reduce size by ~50% while maintaining quality
   * 3. Generate thumbnail
   */

  /**
   * A filename safe to join onto a temporary directory.
   *
   * The multipart filename is attacker-controlled: joined raw, a name like
   * `x/../../../tmp/evil.sh` resolved clean out of the temp directory and turned
   * an upload into an arbitrary-path write with attacker-chosen bytes. Only the
   * basename is kept and everything outside a conservative character class is
   * replaced, matching what StorageService already does for permanent files.
   */
  private safeTempName(originalName: string): string {
    const base = path.basename(originalName || 'upload');
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    return cleaned.replace(/^\.+/, '_') || 'upload';
  }

  async processShortVideo(
    buffer: Buffer,
    originalName: string,
  ): Promise<ProcessedVideo> {
    const tmpDir = path.join(os.tmpdir(), `shorts-${randomUUID()}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const inputPath = path.join(
      tmpDir,
      `input-${this.safeTempName(originalName)}`,
    );
    const outputPath = path.join(tmpDir, 'output.mp4');
    const thumbPath = path.join(tmpDir, 'thumb.jpg');

    try {
      await fs.promises.writeFile(inputPath, buffer);

      // Get video info (duration, dimensions)
      const info = await this.getVideoInfo(inputPath);

      // A video we cannot probe cannot be size-checked. Rejecting here closes
      // the hole where an unprobable (or crafted) file defaulted to duration 0
      // and slipped past the 60s cap into storage.
      if (!info.probed || !(info.duration > 0)) {
        throw new BadRequestException(
          'Could not read this video. Please upload a valid MP4, WebM, or MOV file.',
        );
      }

      if (info.duration > this.MAX_DURATION) {
        throw new BadRequestException(
          `Video duration (${Math.ceil(info.duration)}s) exceeds maximum of ${this.MAX_DURATION}s. Please trim your video before uploading.`,
        );
      }

      // Compress video: target ~50% size reduction
      // Use CRF 28 with H.264, scale to max 720p vertical
      await this.compressVideo(inputPath, outputPath, info);

      // Generate thumbnail from first frame
      await this.generateThumbnail(inputPath, thumbPath);

      const [compressedBuffer, thumbnailBuffer] = await Promise.all([
        fs.promises.readFile(outputPath),
        fs.promises.readFile(thumbPath),
      ]);

      return {
        compressedBuffer,
        thumbnailBuffer,
        duration: Math.min(info.duration, this.MAX_DURATION),
        width: Math.min(info.width, 720),
        height: Math.min(info.height, 1280),
      };
    } finally {
      // Cleanup temp files
      await fs.promises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(() => {});
    }
  }

  /**
   * Trim a video to the specified start/end time (for cropping longer videos).
   */
  async trimVideo(
    buffer: Buffer,
    originalName: string,
    startSeconds: number,
    endSeconds: number,
  ): Promise<Buffer> {
    if (endSeconds - startSeconds > this.MAX_DURATION) {
      throw new BadRequestException(
        `Trimmed duration cannot exceed ${this.MAX_DURATION} seconds`,
      );
    }

    const tmpDir = path.join(os.tmpdir(), `shorts-trim-${randomUUID()}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const inputPath = path.join(
      tmpDir,
      `input-${this.safeTempName(originalName)}`,
    );
    const outputPath = path.join(tmpDir, 'trimmed.mp4');

    try {
      await fs.promises.writeFile(inputPath, buffer);

      const duration = endSeconds - startSeconds;
      await execFileAsync('ffmpeg', [
        '-i',
        inputPath,
        '-ss',
        startSeconds.toString(),
        '-t',
        duration.toString(),
        '-c',
        'copy',
        '-y',
        outputPath,
      ]);

      return fs.promises.readFile(outputPath);
    } finally {
      await fs.promises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(() => {});
    }
  }

  private async getVideoInfo(filePath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    probed: boolean;
  }> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find(
        (s: any) => s.codec_type === 'video',
      );

      return {
        duration: parseFloat(data.format?.duration ?? '0'),
        width: videoStream?.width ?? 720,
        height: videoStream?.height ?? 1280,
        // Only a real video stream counts as a successful probe. A file with no
        // video stream (audio-only, corrupt) must not pass the duration gate.
        probed: !!videoStream,
      };
    } catch (err) {
      // `probed: false` — the caller rejects the upload rather than defaulting
      // the duration to 0 and letting an unbounded file through.
      this.logger.warn(`ffprobe failed: ${(err as Error).message}`);
      return { duration: 0, width: 720, height: 1280, probed: false };
    }
  }

  private async compressVideo(
    inputPath: string,
    outputPath: string,
    info: { width: number; height: number },
  ): Promise<void> {
    // Scale to max 720x1280 (portrait) while maintaining aspect ratio
    const scaleFilter =
      info.width > 720 || info.height > 1280
        ? ['-vf', 'scale=720:1280:force_original_aspect_ratio=decrease']
        : [];

    const args = [
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '28', // Good quality with ~50% compression
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      ...scaleFilter,
      '-movflags',
      '+faststart', // Enable streaming
      '-y',
      outputPath,
    ];

    try {
      await execFileAsync('ffmpeg', args, { timeout: 120000 });
    } catch (err) {
      this.logger.error(`Video compression failed: ${(err as Error).message}`);
      // Fallback: copy the original file
      await fs.promises.copyFile(inputPath, outputPath);
    }
  }

  private async generateThumbnail(
    inputPath: string,
    thumbPath: string,
  ): Promise<void> {
    try {
      await execFileAsync('ffmpeg', [
        '-i',
        inputPath,
        '-ss',
        '00:00:01',
        '-vframes',
        '1',
        '-vf',
        'scale=360:640:force_original_aspect_ratio=decrease',
        '-q:v',
        '3',
        '-y',
        thumbPath,
      ]);
    } catch (err) {
      this.logger.warn(
        `Thumbnail generation failed: ${(err as Error).message}`,
      );
      // Create a placeholder thumbnail using a 1x1 pixel JPEG
      const placeholder = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxBn/9k=',
        'base64',
      );
      await fs.promises.writeFile(thumbPath, placeholder);
    }
  }
}

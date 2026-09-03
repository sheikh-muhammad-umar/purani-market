import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  fileUrl: string;
  key: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    const port = this.configService.get<number>('port') ?? 3000;
    this.baseUrl = `http://localhost:${port}/uploads`;
    this.ensureDir(this.uploadDir);
  }

  async saveFile(
    folder: string,
    filename: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const uniqueName = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const dir = path.join(this.uploadDir, folder);

    // Prevent path traversal.
    //
    // Compared with a trailing separator, not by bare prefix: `startsWith`
    // alone also accepts a sibling directory whose name merely begins with the
    // upload directory's, so a folder resolving to `<cwd>/uploads_elsewhere`
    // passed. The folder is caller-supplied — one segment of it comes from a URL
    // parameter — so this is the boundary, not a formality.
    const resolvedDir = path.resolve(dir);
    if (!this.isInsideUploadDir(resolvedDir)) {
      throw new Error('Invalid upload path');
    }

    this.ensureDir(resolvedDir);

    const filePath = path.join(resolvedDir, uniqueName);
    await fs.promises.writeFile(filePath, buffer);

    const key = `${folder}/${uniqueName}`;
    return {
      fileUrl: `${this.baseUrl}/${key}`,
      key,
    };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.resolve(this.uploadDir, key);
      // Prevent path traversal
      if (!this.isInsideUploadDir(filePath)) {
        this.logger.warn(`Path traversal attempt blocked: ${key}`);
        return;
      }
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      this.logger.warn(`Failed to delete file ${key}: ${err.message}`);
    }
  }

  /**
   * Whether a resolved path is the upload directory or genuinely beneath it.
   *
   * The separator is what makes this different from a prefix test: without it,
   * `<cwd>/uploads-public` counts as inside `<cwd>/uploads`.
   */
  private isInsideUploadDir(resolved: string): boolean {
    return (
      resolved === this.uploadDir ||
      resolved.startsWith(this.uploadDir + path.sep)
    );
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

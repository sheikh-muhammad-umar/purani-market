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

    // Prevent path traversal
    const resolvedDir = path.resolve(dir);
    if (!resolvedDir.startsWith(this.uploadDir)) {
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
      if (!filePath.startsWith(this.uploadDir)) {
        this.logger.warn(`Path traversal attempt blocked: ${key}`);
        return;
      }
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      this.logger.warn(`Failed to delete file ${key}: ${err.message}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

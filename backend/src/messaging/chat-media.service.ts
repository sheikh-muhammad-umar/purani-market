import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from '../listings/storage.service.js';
import { ERROR } from '../common/constants/error-messages.js';
import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_AUDIO_MIMES,
  MAX_IMAGE_SIZE,
  MAX_VOICE_SIZE,
  MAX_VOICE_DURATION,
  COMPRESSED_IMAGE_MIME,
} from './messaging.constants.js';

export interface ChatMediaResult {
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  mimeType?: string;
  fileSize?: number;
}

@Injectable()
export class ChatMediaService {
  constructor(private readonly storageService: StorageService) {}

  async processImage(
    conversationId: string,
    file: Express.Multer.File,
  ): Promise<ChatMediaResult> {
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(ERROR.INVALID_CHAT_IMAGE_FORMAT);
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(ERROR.CHAT_IMAGE_SIZE_EXCEEDED);
    }

    const folder = `chat/${conversationId}`;

    const compressed = await sharp(file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnail = await sharp(file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const safeName = `img-${Date.now()}.jpg`;

    const [imgResult, thumbResult] = await Promise.all([
      this.storageService.saveFile(`${folder}/images`, safeName, compressed),
      this.storageService.saveFile(
        `${folder}/thumbs`,
        `thumb-${safeName}`,
        thumbnail,
      ),
    ]);

    return {
      url: imgResult.fileUrl,
      thumbnailUrl: thumbResult.fileUrl,
      mimeType: COMPRESSED_IMAGE_MIME,
      fileSize: compressed.length,
    };
  }

  async processVoiceNote(
    conversationId: string,
    file: Express.Multer.File,
    duration?: number,
  ): Promise<ChatMediaResult> {
    if (!ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(ERROR.INVALID_CHAT_AUDIO_FORMAT);
    }
    if (file.size > MAX_VOICE_SIZE) {
      throw new BadRequestException(ERROR.CHAT_VOICE_SIZE_EXCEEDED);
    }
    if (duration && duration > MAX_VOICE_DURATION) {
      throw new BadRequestException(ERROR.CHAT_VOICE_DURATION_EXCEEDED);
    }

    const folder = `chat/${conversationId}`;
    const ext = file.mimetype.split('/')[1] || 'webm';
    const safeName = `voice-${Date.now()}.${ext}`;

    const result = await this.storageService.saveFile(
      `${folder}/voice`,
      safeName,
      file.buffer,
    );

    return {
      url: result.fileUrl,
      duration,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }
}

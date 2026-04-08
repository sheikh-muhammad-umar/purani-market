import { ConfigService } from '@nestjs/config';
export interface UploadResult {
    fileUrl: string;
    key: string;
}
export declare class StorageService {
    private readonly configService;
    private readonly logger;
    private readonly uploadDir;
    private readonly baseUrl;
    constructor(configService: ConfigService);
    saveFile(folder: string, filename: string, buffer: Buffer): Promise<UploadResult>;
    deleteFile(key: string): Promise<void>;
    private ensureDir;
}

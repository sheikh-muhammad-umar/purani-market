export interface PresignedUrlResult {
    uploadUrl: string;
    fileUrl: string;
    key: string;
}
export declare class StorageService {
    private readonly bucketName;
    private readonly baseUrl;
    generatePresignedUploadUrl(folder: string, filename: string, contentType: string): Promise<PresignedUrlResult>;
    deleteFile(key: string): Promise<void>;
}

export declare enum MediaType {
    IMAGE = "image",
    VIDEO = "video"
}
export declare class UploadMediaDto {
    type: MediaType;
    sortOrder?: number;
}

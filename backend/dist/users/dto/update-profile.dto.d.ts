export declare class UpdateLocationDto {
    type?: string;
    coordinates?: number[];
}
export declare class UpdateProfileDto {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    location?: UpdateLocationDto;
    city?: string;
    postalCode?: string;
}

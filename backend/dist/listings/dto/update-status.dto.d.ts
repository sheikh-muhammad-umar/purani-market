export declare enum AllowedStatusTransition {
    SOLD = "sold",
    RESERVED = "reserved",
    INACTIVE = "inactive",
    ACTIVE = "active"
}
export declare class UpdateStatusDto {
    status: AllowedStatusTransition;
}

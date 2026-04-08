import { LocationsService } from './locations.service.js';
export declare class LocationsController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
    getProvinces(): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getCities(provinceId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getAreas(cityId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getSubareas(areaId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getBlocks(subareaId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getChildren(parentId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    search(query: string, limit?: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/pakistan-location.schema.js").PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/pakistan-location.schema.js").PakistanLocation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}

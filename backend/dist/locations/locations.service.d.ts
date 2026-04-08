import { Model, Types } from 'mongoose';
import { PakistanLocation, PakistanLocationDocument } from './schemas/pakistan-location.schema.js';
export declare class LocationsService {
    private readonly locationModel;
    constructor(locationModel: Model<PakistanLocationDocument>);
    getProvinces(): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getCities(provinceId: string): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getAreas(cityId: string): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getSubareas(areaId: string): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getBlocks(subareaId: string): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getChildren(parentId: string): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    search(query: string, limit?: number): Promise<(import("mongoose").Document<unknown, {}, PakistanLocation, {}, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}

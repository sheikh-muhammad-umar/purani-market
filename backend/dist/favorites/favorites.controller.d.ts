import { FavoritesService } from './favorites.service.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
export declare class FavoritesController {
    private readonly favoritesService;
    constructor(favoritesService: FavoritesService);
    addFavorite(userId: string, dto: AddFavoriteDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/favorite.schema.js").Favorite, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/favorite.schema.js").Favorite & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    getUserFavorites(userId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/favorite.schema.js").Favorite, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/favorite.schema.js").Favorite & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    removeFavorite(favoriteId: string, userId: string): Promise<{
        message: string;
    }>;
}

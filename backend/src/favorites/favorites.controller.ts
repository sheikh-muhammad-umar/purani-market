import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
import { MAX_FAVORITES_PER_PAGE } from '../common/constants/app.constants.js';

@Controller('api/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  async addFavorite(
    @CurrentUser('sub') userId: string,
    @Body() dto: AddFavoriteDto,
  ) {
    return this.favoritesService.addFavorite(userId, dto.productListingId);
  }

  @Get()
  async getUserFavorites(
    @CurrentUser('sub') userId: string,
    @Query('limit', new DefaultValuePipe(MAX_FAVORITES_PER_PAGE), ParseIntPipe)
    limit: number,
  ) {
    const safeLimit = Math.min(Math.max(1, limit), MAX_FAVORITES_PER_PAGE);
    return this.favoritesService.getUserFavorites(userId, safeLimit);
  }

  @Delete(':id')
  async removeFavorite(
    @Param('id') favoriteId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.favoritesService.removeFavorite(favoriteId, userId);
    return { message: 'Favorite removed successfully' };
  }
}

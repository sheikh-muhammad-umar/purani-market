import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LocationService } from './location.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { NearbyQueryDto } from './dto/nearby-query.dto.js';
import { GeocodeQueryDto } from './dto/geocode-query.dto.js';

@Controller('api/location')
@UseGuards(JwtAuthGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('nearby')
  async getNearbyListings(@Query() query: NearbyQueryDto) {
    this.locationService.validateCoordinates(query.lat, query.lng);

    return this.locationService.findNearby(
      query.lat,
      query.lng,
      query.radius,
      query.limit,
      query.page,
    );
  }

  /**
   * Geocode a city name or postal code to coordinates.
   * Used as fallback when geolocation is unavailable (Requirement 15.4).
   */
  @Get('geocode')
  async geocodeLocation(@Query() query: GeocodeQueryDto) {
    return this.locationService.geocode(query.query);
  }
}

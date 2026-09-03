import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';

export interface PublicSellerProfile {
  _id: string;
  name: string;
  avatar: string;
  city: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  memberSince: string;
  averageRating: number;
  reviewCount: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly api: ApiService) {}

  getPublicProfile(userId: string): Observable<PublicSellerProfile> {
    return this.api.get<PublicSellerProfile>(API.USERS_PUBLIC(userId));
  }
}

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AdPackage, PackagePurchase, PaymentMethod } from '../models';
import { API } from '../constants/api-endpoints';

export interface PackagesListResponse {
  data: AdPackage[];
  total: number;
}

export interface MyPurchasesResponse {
  data: PackagePurchase[];
  total: number;
}

export interface PurchasePayload {
  packageId: string;
  paymentMethod: PaymentMethod;
  categoryId?: string;
}

export interface PurchaseResponse {
  redirectUrl: string;
  transactionId: string;
}

@Injectable({ providedIn: 'root' })
export class PackagesService {
  constructor(private readonly api: ApiService) {}

  getAll(): Observable<PackagesListResponse> {
    return this.api.get<PackagesListResponse>(API.PACKAGES);
  }

  getById(id: string): Observable<AdPackage> {
    return this.api.get<AdPackage>(API.PACKAGE_BY_ID(id));
  }

  purchase(payload: PurchasePayload): Observable<PurchaseResponse> {
    return this.api.post<PurchaseResponse>(API.PACKAGES_PURCHASE, payload);
  }

  getMyPurchases(): Observable<MyPurchasesResponse> {
    return this.api.get<MyPurchasesResponse>(API.PACKAGES_MY_PURCHASES);
  }
}

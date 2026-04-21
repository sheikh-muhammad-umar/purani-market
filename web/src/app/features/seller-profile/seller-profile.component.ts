import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ListingsService } from '../../core/services/listings.service';
import { Listing } from '../../core/models';
import { VerificationBadgesComponent } from '../../shared/components/verification-badges/verification-badges.component';
import { ListingUrlPipe } from '../../shared/pipes/listing-url.pipe';

interface SellerProfile {
  _id: string;
  name: string;
  avatar: string;
  city: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  memberSince: string;
}

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, VerificationBadgesComponent, ListingUrlPipe],
  templateUrl: './seller-profile.component.html',
  styleUrl: './seller-profile.component.scss',
})
export class SellerProfileComponent implements OnInit {
  readonly loading = signal(true);
  readonly seller = signal<SellerProfile | null>(null);
  readonly listings = signal<Listing[]>([]);
  readonly totalListings = signal(0);

  private sellerId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ApiService,
    private readonly listingsService: ListingsService,
  ) {}

  ngOnInit(): void {
    this.sellerId = this.route.snapshot.paramMap.get('id') || '';
    if (this.sellerId) {
      this.loadProfile();
      this.loadListings();
    }
  }

  private loadProfile(): void {
    this.api.get<any>(`/users/${this.sellerId}/public`).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.seller.set(data);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  private loadListings(): void {
    this.listingsService.getBySeller(this.sellerId).subscribe({
      next: (res) => {
        this.listings.set(res.data);
        this.totalListings.set(res.total);
      },
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  }
}

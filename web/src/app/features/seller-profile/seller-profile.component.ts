import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UsersService, PublicSellerProfile } from '../../core/services/users.service';
import { ListingsService } from '../../core/services/listings.service';
import { ShortsService, ShortVideo } from '../../core/services/shorts.service';
import { Listing } from '../../core/models';
import { TAB, TabType } from '../../core/constants/enums';
import { VerificationBadgesComponent } from '../../shared/components/verification-badges/verification-badges.component';
import { ListingUrlPipe } from '../../shared/pipes/listing-url.pipe';
import { extractIdFromSlug } from '../../core/utils/slug';

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, VerificationBadgesComponent, ListingUrlPipe],
  templateUrl: './seller-profile.component.html',
  styleUrl: './seller-profile.component.scss',
})
export class SellerProfileComponent implements OnInit {
  readonly TAB = TAB;
  readonly loading = signal(true);
  readonly seller = signal<PublicSellerProfile | null>(null);
  readonly listings = signal<Listing[]>([]);
  readonly shorts = signal<ShortVideo[]>([]);
  readonly totalListings = signal(0);
  readonly totalShorts = signal(0);
  readonly activeTab = signal<TabType>(TAB.LISTINGS);

  private sellerId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly usersService: UsersService,
    private readonly listingsService: ListingsService,
    private readonly shortsService: ShortsService,
  ) {}

  ngOnInit(): void {
    const rawParam = this.route.snapshot.paramMap.get('id') || '';
    this.sellerId = extractIdFromSlug(rawParam);
    if (this.sellerId) {
      this.loadProfile();
      this.loadListings();
      this.loadShorts();
    }
  }

  private loadProfile(): void {
    this.usersService.getPublicProfile(this.sellerId).subscribe({
      next: (data) => {
        this.seller.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
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

  private loadShorts(): void {
    this.shortsService.getSellerShorts(this.sellerId).subscribe({
      next: (res) => {
        this.shorts.set(res.data);
        this.totalShorts.set(res.total);
      },
    });
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  }

  formatShortDuration(seconds?: number): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

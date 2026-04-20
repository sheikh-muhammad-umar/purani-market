import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';

interface ActivityEntry {
  _id: string;
  userId: string;
  action: string;
  productListingId?: string;
  searchQuery?: string;
  categoryId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

@Component({
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, DatePickerComponent],
  templateUrl: './user-activity.component.html',
  styleUrl: './user-activity.component.scss',
})
export class UserActivityComponent implements OnInit {
  readonly loading = signal(false);
  readonly activities = signal<ActivityEntry[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);

  filterUserId = '';
  filterAction = '';
  filterDateFrom = '';
  filterDateTo = '';
  sortBy = 'newest';
  page = 1;
  filtersOpen = false;
  expandedId: string | null = null;

  get hasActiveFilters(): boolean {
    return !!(this.filterUserId || this.filterAction || this.filterDateFrom || this.filterDateTo);
  }

  get activeFilterCount(): number {
    let c = 0;
    if (this.filterUserId) c++;
    if (this.filterAction) c++;
    if (this.filterDateFrom || this.filterDateTo) c++;
    return c;
  }

  readonly actionOptions: SelectOption[] = [
    { value: '', label: 'All Actions' },
    { value: 'view', label: 'View Listing' },
    { value: 'search', label: 'Search' },
    { value: 'category_browse', label: 'Category Browse' },
    { value: 'page_view', label: 'Page View' },
    { value: 'favorite', label: 'Favorite' },
    { value: 'unfavorite', label: 'Unfavorite' },
    { value: 'contact', label: 'Contact' },
    { value: 'listing_create', label: 'Listing Create' },
    { value: 'listing_edit', label: 'Listing Edit' },
    { value: 'listing_delete', label: 'Listing Delete' },
    { value: 'listing_status_change', label: 'Status Change' },
    { value: 'listing_feature', label: 'Feature Ad' },
    { value: 'login', label: 'Login' },
    { value: 'register', label: 'Register' },
    { value: 'logout', label: 'Logout' },
    { value: 'message_sent', label: 'Message Sent' },
    { value: 'conversation_start', label: 'Conversation Start' },
    { value: 'package_purchase', label: 'Package Purchase' },
    { value: 'payment_attempt', label: 'Payment Attempt' },
    { value: 'location_change', label: 'Location Change' },
    { value: 'admin_user_status_change', label: 'Admin: User Status' },
    { value: 'admin_user_role_change', label: 'Admin: User Role' },
    { value: 'admin_user_ad_limit_change', label: 'Admin: Ad Limit' },
    { value: 'admin_listing_approve', label: 'Admin: Approve Listing' },
    { value: 'admin_listing_reject', label: 'Admin: Reject Listing' },
    { value: 'admin_category_create', label: 'Admin: Create Category' },
    { value: 'admin_category_update', label: 'Admin: Update Category' },
    { value: 'admin_category_delete', label: 'Admin: Delete Category' },
    { value: 'admin_category_attributes_update', label: 'Admin: Update Attributes' },
    { value: 'admin_category_features_update', label: 'Admin: Update Features' },
    { value: 'admin_location_create', label: 'Admin: Create Location' },
    { value: 'admin_location_update', label: 'Admin: Update Location' },
    { value: 'admin_location_delete', label: 'Admin: Delete Location' },
    { value: 'admin_package_create', label: 'Admin: Create Package' },
    { value: 'admin_package_update', label: 'Admin: Update Package' },
    { value: 'admin_export_report', label: 'Admin: Export Report' },
  ];

  readonly sortOptions: SelectOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ];

  // Metadata keys grouped by category for better readability
  private readonly deviceKeys = ['browser', 'os', 'deviceType', 'deviceVendor', 'deviceModel', 'engine', 'platform', 'mobile'];
  private readonly screenKeys = ['screenResolution', 'viewportSize', 'colorDepth', 'pixelRatio', 'touchSupport'];
  private readonly networkKeys = ['connectionType', 'online', 'ip'];
  private readonly locationKeys = ['locationProvince', 'locationCity', 'locationArea', 'geoLat', 'geoLng', 'geoAccuracy'];
  private readonly systemKeys = ['language', 'languages', 'timezone', 'timezoneOffset', 'cookiesEnabled', 'hardwareConcurrency', 'deviceMemory'];

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadActivity();
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  loadActivity(): void {
    this.loading.set(true);
    const [sort, order] = this.sortBy === 'oldest'
      ? ['createdAt', 'asc' as const]
      : ['createdAt', 'desc' as const];

    this.adminService.getAllActivity({
      page: this.page,
      limit: 50,
      action: this.filterAction || undefined,
      userId: this.filterUserId.trim() || undefined,
      dateFrom: this.filterDateFrom || undefined,
      dateTo: this.filterDateTo || undefined,
      sort,
      order,
    }).subscribe({
      next: (res: any) => {
        this.activities.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.totalPages.set(res.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.activities.set([]);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadActivity();
  }

  resetFilters(): void {
    this.filterUserId = '';
    this.filterAction = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.sortBy = 'newest';
    this.page = 1;
    this.loadActivity();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page = p;
    this.loadActivity();
  }

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      view: 'visibility', search: 'search', category_browse: 'category',
      page_view: 'web', favorite: 'favorite', unfavorite: 'heart_broken',
      contact: 'call', share: 'share', listing_create: 'add_circle',
      listing_edit: 'edit', listing_delete: 'delete',
      listing_status_change: 'swap_horiz', listing_feature: 'star',
      login: 'login', register: 'person_add', logout: 'logout',
      message_sent: 'send', conversation_start: 'chat',
      package_purchase: 'shopping_cart', payment_attempt: 'payment',
      location_change: 'location_on', dismiss: 'close',
      recommendation_click: 'recommend',
      admin_user_status_change: 'manage_accounts', admin_user_role_change: 'admin_panel_settings',
      admin_user_ad_limit_change: 'tune', admin_listing_approve: 'check_circle',
      admin_listing_reject: 'cancel', admin_category_create: 'create_new_folder',
      admin_category_update: 'edit_note', admin_category_delete: 'folder_delete',
      admin_category_attributes_update: 'list_alt', admin_category_features_update: 'checklist',
      admin_location_create: 'add_location', admin_location_update: 'edit_location_alt',
      admin_location_delete: 'wrong_location', admin_package_create: 'add_shopping_cart',
      admin_package_update: 'inventory', admin_export_report: 'download',
    };
    return icons[action] || 'info';
  }

  getActionColor(action: string): string {
    const colors: Record<string, string> = {
      login: '#00B894', register: '#00B894', logout: '#636e72',
      listing_create: '#0DA5C3', listing_edit: '#FDCB6E', listing_delete: '#E74C3C',
      listing_status_change: '#6C5CE7', listing_feature: '#F39C12',
      favorite: '#E74C3C', unfavorite: '#636e72',
      message_sent: '#0DA5C3', conversation_start: '#0DA5C3',
      package_purchase: '#00B894', payment_attempt: '#F39C12',
      search: '#6C5CE7', contact: '#00B894',
      admin_user_status_change: '#E74C3C', admin_user_role_change: '#6C5CE7',
      admin_user_ad_limit_change: '#F39C12', admin_listing_approve: '#00B894',
      admin_listing_reject: '#E74C3C', admin_category_create: '#0DA5C3',
      admin_category_update: '#FDCB6E', admin_category_delete: '#E74C3C',
      admin_category_attributes_update: '#6C5CE7', admin_category_features_update: '#6C5CE7',
      admin_location_create: '#0DA5C3', admin_location_update: '#FDCB6E',
      admin_location_delete: '#E74C3C', admin_package_create: '#00B894',
      admin_package_update: '#F39C12', admin_export_report: '#636e72',
    };
    return colors[action] || '#0DA5C3';
  }

  /** Get a short summary line for the activity card */
  getSummary(entry: ActivityEntry): string {
    const m = entry.metadata || {};
    switch (entry.action) {
      case 'login': return `via ${m['method'] || 'unknown'} • ${m['browser'] || ''} on ${m['os'] || ''}`.trim();
      case 'logout': return `${m['browser'] || ''} on ${m['os'] || ''}`.trim() || 'Session ended';
      case 'search': return entry.searchQuery ? `"${entry.searchQuery}"` : '';
      case 'listing_status_change': return m['previousStatus'] ? `${m['previousStatus']} → ${m['newStatus']}` : '';
      case 'location_change': return m['newLocation'] || m['locationCity'] || '';
      case 'contact': return m['type'] === 'call' ? 'Phone call' : m['type'] === 'message' ? 'Message' : '';
      case 'listing_create': case 'listing_edit': return m['title'] || '';
      case 'package_purchase': return m['packageName'] || '';
      default: return '';
    }
  }

  /** Check if entry has rich details worth expanding */
  hasDetails(entry: ActivityEntry): boolean {
    if (entry.ip || entry.userAgent) return true;
    if (entry.productListingId || entry.searchQuery || entry.categoryId) return true;
    const m = entry.metadata || {};
    return Object.keys(m).filter(k => m[k] != null && m[k] !== '').length > 0;
  }

  /** Get grouped metadata sections for the expanded detail view */
  getDetailSections(entry: ActivityEntry): { label: string; icon: string; items: { key: string; value: any }[] }[] {
    const m = entry.metadata || {};
    const sections: { label: string; icon: string; items: { key: string; value: any }[] }[] = [];

    // Context info (always first)
    const contextItems: { key: string; value: any }[] = [];
    if (entry.searchQuery) contextItems.push({ key: 'Search Query', value: entry.searchQuery });
    if (entry.productListingId) contextItems.push({ key: 'Listing ID', value: entry.productListingId });
    if (entry.categoryId) contextItems.push({ key: 'Category ID', value: entry.categoryId });
    // Add non-grouped metadata keys
    const allGrouped = new Set([...this.deviceKeys, ...this.screenKeys, ...this.networkKeys, ...this.locationKeys, ...this.systemKeys]);
    for (const [k, v] of Object.entries(m)) {
      if (!allGrouped.has(k) && v != null && v !== '') {
        contextItems.push({ key: this.formatKey(k), value: v });
      }
    }
    if (contextItems.length) sections.push({ label: 'Context', icon: 'info', items: contextItems });

    // Device & Browser
    const deviceItems = this.pickItems(m, this.deviceKeys);
    if (deviceItems.length) sections.push({ label: 'Device & Browser', icon: 'devices', items: deviceItems });

    // Screen
    const screenItems = this.pickItems(m, this.screenKeys);
    if (screenItems.length) sections.push({ label: 'Screen', icon: 'monitor', items: screenItems });

    // Location
    const locItems = this.pickItems(m, this.locationKeys);
    if (locItems.length) sections.push({ label: 'Location', icon: 'location_on', items: locItems });

    // Network
    const netItems = this.pickItems(m, this.networkKeys);
    if (entry.ip) netItems.unshift({ key: 'IP Address', value: entry.ip });
    if (netItems.length) sections.push({ label: 'Network', icon: 'wifi', items: netItems });

    // System
    const sysItems = this.pickItems(m, this.systemKeys);
    if (sysItems.length) sections.push({ label: 'System', icon: 'settings', items: sysItems });

    return sections;
  }

  private pickItems(m: Record<string, any>, keys: string[]): { key: string; value: any }[] {
    return keys
      .filter(k => m[k] != null && m[k] !== '')
      .map(k => ({ key: this.formatKey(k), value: this.formatValue(k, m[k]) }));
  }

  formatKey(key: string): string {
    const labels: Record<string, string> = {
      browser: 'Browser', os: 'Operating System', deviceType: 'Device Type',
      deviceVendor: 'Vendor', deviceModel: 'Model', engine: 'Engine',
      platform: 'Platform', mobile: 'Mobile', screenResolution: 'Screen',
      viewportSize: 'Viewport', colorDepth: 'Color Depth', pixelRatio: 'Pixel Ratio',
      touchSupport: 'Touch', connectionType: 'Connection', online: 'Online',
      language: 'Language', languages: 'Languages', timezone: 'Timezone',
      timezoneOffset: 'UTC Offset', cookiesEnabled: 'Cookies', hardwareConcurrency: 'CPU Cores',
      deviceMemory: 'Memory (GB)', locationProvince: 'Province', locationCity: 'City',
      locationArea: 'Area', geoLat: 'Latitude', geoLng: 'Longitude',
      geoAccuracy: 'GPS Accuracy (m)', method: 'Login Method',
      previousStatus: 'Previous Status', newStatus: 'New Status',
      title: 'Listing Title', packageName: 'Package',
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  private formatValue(key: string, value: any): string {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'timezoneOffset') return `UTC${value <= 0 ? '+' : '-'}${Math.abs(value / 60)}`;
    if (key === 'geoAccuracy') return `±${Math.round(value)}m`;
    if (key === 'deviceMemory') return `${value} GB`;
    return String(value);
  }
}

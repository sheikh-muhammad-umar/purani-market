import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
import { SearchPlaceholderService } from '../../../core/services/search-placeholder.service';
import { ROUTES } from '../../../core/constants/routes';
import { VoiceSearchComponent } from '../voice-search/voice-search.component';

/** Delay (ms) before closing the recents panel, so a click inside registers. */
const BLUR_DELAY = 200;

/**
 * Search field for the app header: query input, rotating category placeholder,
 * recent-search suggestions and voice input.
 *
 * The header renders this twice — in the desktop bar and in the mobile row —
 * which previously meant two near-identical copies of the markup and of the
 * clear/focus/blur/recents handlers.
 */
@Component({
  selector: 'app-header-search',
  standalone: true,
  imports: [VoiceSearchComponent],
  templateUrl: './header-search.component.html',
  styleUrls: ['./header-search.component.scss'],
})
export class HeaderSearchComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly placeholderService = inject(SearchPlaceholderService);
  protected readonly recentSearches = inject(RecentSearchesService);

  /** `bar` is the desktop search bar; `compact` is the mobile row. */
  readonly variant = input<'bar' | 'compact'>('bar');

  protected readonly query = signal('');
  protected readonly recentsOpen = signal(false);

  /** Names the CSS rotation cycles through; the animation itself is in the SCSS. */
  protected readonly placeholderSlots = this.placeholderService.slots;

  /** Unique ids so label/input and aria-controls stay valid with two instances. */
  protected readonly inputId = `hs-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly recentsId = `${this.inputId}-recents`;

  private input?: HTMLInputElement;
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;

  // Setter injection rather than inject()/effect(): keeps the component
  // constructible outside an injection context.
  @ViewChild('searchInput')
  protected set searchInputRef(ref: ElementRef<HTMLInputElement> | undefined) {
    this.input = ref?.nativeElement;
  }

  ngOnInit(): void {
    this.placeholderService.start();
  }

  ngOnDestroy(): void {
    if (this.blurTimeout) clearTimeout(this.blurTimeout);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const q = this.query().trim();
    if (!q) {
      this.input?.focus();
      return;
    }
    this.recentSearches.add(q);
    this.recentsOpen.set(false);
    this.router.navigate([ROUTES.SEARCH], { queryParams: { q } });
  }

  protected clear(): void {
    this.query.set('');
    if (this.input) {
      this.input.value = '';
      this.input.focus();
    }
  }

  protected onFocus(): void {
    if (this.recentSearches.searches().length) this.recentsOpen.set(true);
  }

  protected onBlur(): void {
    this.blurTimeout = setTimeout(() => this.recentsOpen.set(false), BLUR_DELAY);
  }

  protected selectRecent(term: string): void {
    this.query.set(term);
    if (this.input) this.input.value = term;
    this.recentSearches.add(term);
    this.recentsOpen.set(false);
    this.router.navigate([ROUTES.SEARCH], { queryParams: { q: term } });
  }

  protected removeRecent(term: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.recentSearches.remove(term);
    if (!this.recentSearches.searches().length) this.recentsOpen.set(false);
    this.input?.focus();
  }

  protected clearRecents(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.recentSearches.clear();
    this.recentsOpen.set(false);
  }

  protected onVoiceResult(transcript: string): void {
    this.query.set(transcript);
    if (this.input) this.input.value = transcript;
    this.recentSearches.add(transcript);
    this.router.navigate([ROUTES.SEARCH], { queryParams: { q: transcript } });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('app-header-search')) this.recentsOpen.set(false);
  }
}

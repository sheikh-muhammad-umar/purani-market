import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { Advertiser } from '../../../core/models';

/** Long enough that a typed brand name is not one request per character. */
const SEARCH_DEBOUNCE_MS = 300;

/** Matches the backend's `MinLength(2)` on an advertiser name. */
const MIN_NAME_LENGTH = 2;

/** Nobody scrolls a typeahead further than this. */
const TYPEAHEAD_LIMIT = 20;

/** Distinguishes ids when more than one picker is on a page. */
let instanceCount = 0;

/**
 * Picks the advertiser a campaign belongs to, and creates the brand inline when
 * it is not on file yet.
 *
 * Replaces a plain `<select>` over every advertiser, which stopped being usable
 * once the roster outgrew a screenful and forced operators to leave a
 * half-finished campaign to go and add a brand first.
 *
 * Two deliberate shapes here:
 *
 * - The panel sits in the normal flow rather than floating. It renders inside
 *   `.ads-dialog`, which is `overflow-y: auto`, so an absolutely-positioned menu
 *   would be clipped at the dialog's edge instead of overlapping it.
 * - Inline creation asks only for a name, since that is the sole required field.
 *   Contact details are left to the Advertisers screen rather than reproducing
 *   that whole form inside a nested dialog.
 */
@Component({
  selector: 'app-advertiser-picker',
  standalone: true,
  template: `
    <div class="apick" [class.apick-open]="open()">
      <button
        type="button"
        class="form-input apick-trigger"
        [disabled]="isDisabled()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        [attr.aria-labelledby]="labelledBy()"
        (click)="toggle()"
      >
        @if (displayName()) {
          <span class="apick-value">{{ displayName() }}</span>
        } @else {
          <span class="apick-placeholder">{{ placeholder() }}</span>
        }
        <span class="material-symbols-rounded apick-arrow" aria-hidden="true">expand_more</span>
      </button>

      @if (open()) {
        <div class="apick-panel" [id]="panelId">
          <input
            #searchInput
            type="text"
            class="apick-search"
            role="combobox"
            autocomplete="off"
            [attr.aria-expanded]="true"
            [attr.aria-controls]="listboxId"
            [attr.aria-activedescendant]="activeId()"
            aria-autocomplete="list"
            [attr.aria-label]="'Search advertisers by name'"
            [placeholder]="'Search or type a new brand name'"
            [value]="query()"
            (input)="onSearch($any($event.target).value)"
            (keydown)="onKeydown($event)"
          />

          <div class="apick-list" role="listbox" [id]="listboxId">
            @for (advertiser of visible(); track advertiser._id; let i = $index) {
              <button
                type="button"
                role="option"
                class="apick-option"
                [id]="optionId(i)"
                [class.apick-active]="activeIndex() === i"
                [attr.aria-selected]="advertiser._id === selectedId()"
                (mouseenter)="activeIndex.set(i)"
                (click)="choose(advertiser)"
              >
                <span class="apick-option-name">{{ advertiser.name }}</span>
                @if (advertiser.status === 'inactive') {
                  <span class="apick-tag">Inactive</span>
                }
              </button>
            }

            @if (canCreate()) {
              <button
                type="button"
                role="option"
                class="apick-option apick-create"
                [id]="optionId(visible().length)"
                [class.apick-active]="activeIndex() === visible().length"
                [attr.aria-selected]="false"
                [disabled]="creating()"
                (mouseenter)="activeIndex.set(visible().length)"
                (click)="createFromQuery()"
              >
                <span class="material-symbols-rounded" aria-hidden="true">add</span>
                <span
                  >{{ creating() ? 'Adding' : 'Add' }} “{{ query().trim() }}” as a new
                  advertiser</span
                >
              </button>
            }

            @if (searching()) {
              <p class="apick-note">Searching…</p>
            } @else if (visible().length === 0 && !canCreate()) {
              <p class="apick-note">
                {{
                  query().trim()
                    ? 'No brand matches. Type at least two characters to add it.'
                    : 'No advertisers yet. Type a brand name to add the first one.'
                }}
              </p>
            }
          </div>

          @if (searchError()) {
            <p class="apick-error">{{ searchError() }}</p>
          }
          @if (createError()) {
            <p class="apick-error">{{ createError() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .apick {
        position: relative;
      }
      .apick-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-1);
        width: 100%;
        text-align: left;
        cursor: pointer;
      }
      .apick-trigger:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .apick-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-primary);
      }
      .apick-placeholder {
        color: var(--text-muted);
      }
      .apick-arrow {
        flex-shrink: 0;
        font-size: 1.25rem;
        color: var(--text-secondary);
        transition: transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
      }
      .apick-open .apick-arrow {
        transform: rotate(180deg);
      }
      .apick-panel {
        margin-top: var(--space-1);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 8px);
        background: var(--surface);
        padding: var(--space-1);
      }
      .apick-search {
        width: 100%;
        padding: 0.5rem 0.65rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 8px);
        background: var(--background);
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .apick-search:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 1px;
      }
      .apick-list {
        max-height: 15rem;
        overflow-y: auto;
        margin-top: var(--space-1);
      }
      .apick-option {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        width: 100%;
        padding: 0.5rem 0.65rem;
        border: 0;
        border-radius: var(--radius-sm, 8px);
        background: none;
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
        text-align: left;
        cursor: pointer;
      }
      .apick-option:disabled {
        cursor: progress;
        opacity: 0.7;
      }
      .apick-active {
        background: var(--hover);
      }
      .apick-option-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .apick-tag {
        flex-shrink: 0;
        margin-left: auto;
        font-size: var(--text-xs);
        color: var(--text-muted);
      }
      .apick-create {
        color: var(--primary);
        font-weight: 600;
      }
      .apick-create .material-symbols-rounded {
        font-size: 1.1rem;
      }
      .apick-note,
      .apick-error {
        margin: var(--space-1) 0 0;
        padding: 0 0.65rem;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .apick-error {
        color: var(--danger);
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AdvertiserPickerComponent),
      multi: true,
    },
  ],
})
export class AdvertiserPickerComponent implements ControlValueAccessor, OnInit, OnDestroy {
  /**
   * Advertisers the host has already loaded, shown before anything is typed so
   * opening the picker costs no request.
   */
  readonly options = input<Advertiser[]>([]);

  readonly placeholder = input('Select a brand');

  /**
   * Id of the element naming this field.
   *
   * The trigger is a button, so a host `<label for>` cannot reach it; pointing
   * at the label by id is what gives the control its accessible name.
   */
  readonly labelledBy = input<string | null>(null);

  /** A brand created here, so the host can fold it into its own list. */
  readonly created = output<Advertiser>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private readonly advertising = inject(AdvertisingService);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly instance = ++instanceCount;
  readonly panelId = `advertiser-picker-panel-${this.instance}`;
  readonly listboxId = `advertiser-picker-list-${this.instance}`;

  readonly open = signal(false);
  readonly query = signal('');
  readonly results = signal<Advertiser[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly isDisabled = signal(false);

  /** Index into `visible()`, or `visible().length` for the create row. */
  readonly activeIndex = signal(-1);

  readonly selectedId = signal('');

  /**
   * Name for an id absent from `options`, filled by a lookup.
   *
   * Needed when editing a campaign whose advertiser the host has not loaded.
   */
  private readonly resolvedName = signal('');

  /** Server results while searching, the host's list when the box is empty. */
  readonly visible = computed(() => (this.query().trim() ? this.results() : this.options()));

  readonly displayName = computed(() => {
    const id = this.selectedId();
    if (!id) return '';
    return this.options().find((a) => a._id === id)?.name ?? this.resolvedName();
  });

  /** Offer creation only for a name long enough to pass, and not already listed. */
  readonly canCreate = computed(() => {
    const typed = this.query().trim();
    if (typed.length < MIN_NAME_LENGTH) return false;
    const lower = typed.toLowerCase();
    return !this.visible().some((a) => a.name.trim().toLowerCase() === lower);
  });

  readonly activeId = computed(() => {
    const index = this.activeIndex();
    return index < 0 ? null : this.optionId(index);
  });

  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((term) => {
          const typed = term.trim();
          if (!typed) {
            this.searching.set(false);
            return of<Advertiser[]>([]);
          }
          this.searching.set(true);
          return this.lookup(typed);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((list) => this.applyResults(list));
  }

  /** One advertiser search, with a failure folded into an empty list. */
  private lookup(term: string) {
    return this.advertising.listAdvertisers(term, TYPEAHEAD_LIMIT).pipe(
      catchError(() => {
        this.searchError.set('Could not search advertisers.');
        return of<Advertiser[]>([]);
      }),
    );
  }

  private applyResults(list: Advertiser[]): void {
    this.searching.set(false);
    this.results.set(list);
    this.activeIndex.set(-1);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  toggle(): void {
    if (this.isDisabled()) return;
    this.open() ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.open.set(true);
    this.query.set('');
    this.results.set([]);
    this.activeIndex.set(-1);
    this.searchError.set('');
    this.createError.set('');
    // The input only exists once the panel has rendered.
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  close(): void {
    this.open.set(false);
    this.onTouched();
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.searchError.set('');
    this.createError.set('');
    this.search$.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.activateCurrent();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private move(step: number): void {
    const total = this.visible().length + (this.canCreate() ? 1 : 0);
    if (total === 0) return;
    const next = this.activeIndex() + step;
    this.activeIndex.set(next < 0 ? total - 1 : next >= total ? 0 : next);
  }

  private activateCurrent(): void {
    const list = this.visible();
    const index = this.activeIndex();

    if (index >= 0 && index < list.length) {
      this.choose(list[index]);
      return;
    }
    // Enter with nothing highlighted takes the obvious single action.
    if (index === list.length && this.canCreate()) {
      this.createFromQuery();
      return;
    }
    if (index < 0) {
      if (list.length > 0) this.choose(list[0]);
      else if (this.canCreate()) this.createFromQuery();
    }
  }

  choose(advertiser: Advertiser): void {
    this.selectedId.set(advertiser._id);
    this.resolvedName.set(advertiser.name);
    this.onChange(advertiser._id);
    this.close();
  }

  createFromQuery(): void {
    const name = this.query().trim();
    if (name.length < MIN_NAME_LENGTH || this.creating()) return;

    this.creating.set(true);
    this.createError.set('');

    this.advertising
      .createAdvertiser({ name })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (advertiser) => {
          this.creating.set(false);
          this.created.emit(advertiser);
          this.choose(advertiser);
        },
        error: (err: { status?: number }) => {
          this.creating.set(false);
          if (err?.status === 409) {
            // Already on file — a race with another operator, or a match that
            // fell outside the result cap. Re-run the search so the row appears
            // instead of leaving a dead-end message.
            this.createError.set(`“${name}” already exists. Pick it from the list.`);
            // Straight to the service, not through `search$`: the term is
            // identical to the one just searched, so `distinctUntilChanged`
            // would drop it and the brand would never appear.
            this.searching.set(true);
            this.lookup(name)
              .pipe(takeUntil(this.destroy$))
              .subscribe((list) => this.applyResults(list));
          } else {
            this.createError.set('Could not add that advertiser.');
          }
        },
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  // ── ControlValueAccessor ──────────────────────────────────────────

  writeValue(value: string | null): void {
    const id = value ?? '';
    this.selectedId.set(id);
    if (!id) {
      this.resolvedName.set('');
      return;
    }
    if (this.options().some((a) => a._id === id)) return;

    this.advertising
      .getAdvertiser(id)
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((advertiser) => {
        if (advertiser && this.selectedId() === id) {
          this.resolvedName.set(advertiser.name);
        }
      });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}

import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  input,
  output,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { LocationShareDialogComponent } from '../location-share/location-share-dialog.component';
import { ListingsService } from '../../../core/services/listings.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Message, Listing, LocationPayload } from '../../../core/models';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { QUICK_REPLIES, PLACEHOLDER_IMAGE } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { ListingStatus } from '../../../core/constants/enums';
import {
  ACCEPTED_IMAGE_TYPES,
  VOICE_MIME_TYPE,
  MESSAGES_PAGE_SIZE,
  TYPING_TIMEOUT_MS,
  SCROLL_DELAY_MS,
  SKELETON_ITEMS,
  WAVEFORM_BARS,
  CHAT_DISABLED_LABELS,
  GROUP_GAP_MS,
  NEAR_BOTTOM_PX,
  TYPING_THROTTLE_MS,
} from '../messaging.constants';
import { MessageDeliveryStatus, MessageRow } from '../interfaces/message-row.interface';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ListingUrlPipe, LocationShareDialogComponent],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('composerInput') composerInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  // Input for split-pane mode
  conversationIdInput = input<string | null>(null);

  /**
   * Thread title and thumbnail, supplied by the layout from the data it has
   * already resolved. Without these the desktop chat pane had no header at all
   * for conversations with no listing — nothing on screen said which thread was
   * open.
   */
  conversationTitle = input('');
  conversationImage = input('');

  back = output<void>();

  readonly messages = signal<Message[]>([]);
  readonly listing = signal<Listing | null>(null);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly typingIndicator = signal(false);
  readonly currentPage = signal(1);
  readonly hasMore = signal(true);
  readonly loadingMore = signal(false);

  // Rich media state
  readonly showAttachMenu = signal(false);
  readonly isRecording = signal(false);
  readonly recordingDuration = signal(0);
  readonly imagePreview = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly showSuggestions = signal(false);
  readonly showLocationPicker = signal(false);

  messageText = '';
  conversationId = '';

  /**
   * Delivery state is tracked as id sets beside `messages()` rather than as
   * fields on the messages themselves, so `messages()` stays the plain server
   * shape that the rest of the component (and its tests) rely on.
   */
  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  private readonly failedIds = signal<ReadonlySet<string>>(new Set());

  /** False once the reader scrolls up away from the newest message. */
  readonly atBottom = signal(true);

  /** Messages that arrived while the reader was scrolled up. */
  readonly unseenCount = signal(0);

  readonly quickReplies = QUICK_REPLIES;
  readonly ROUTES = ROUTES;
  readonly ACCEPTED_IMAGE_TYPES = ACCEPTED_IMAGE_TYPES;
  readonly SKELETON_ITEMS = SKELETON_ITEMS;
  readonly WAVEFORM_BARS = WAVEFORM_BARS;

  readonly currentUserId = computed(() => this.authService.user()?._id ?? '');

  /** Precomputed: whether the chat is disabled (listing not active). */
  readonly chatDisabled = computed(() => {
    const l = this.listing();
    return l != null && l.status !== ListingStatus.ACTIVE;
  });

  /** Precomputed: label explaining why the chat is disabled. */
  readonly chatDisabledLabel = computed(() => {
    const l = this.listing();
    if (!l || l.status === ListingStatus.ACTIVE) return '';
    return (
      CHAT_DISABLED_LABELS[l.status as ListingStatus] ?? 'This listing is no longer available.'
    );
  });

  /** Precomputed: listing image for the product card header. */
  readonly listingImage = computed(() => {
    const l = this.listing();
    return l?.images?.[0]?.thumbnailUrl || l?.images?.[0]?.url || PLACEHOLDER_IMAGE;
  });

  /** Precomputed: recording duration formatted as m:ss. */
  readonly formattedRecordingDuration = computed(() =>
    this.formatDurationValue(this.recordingDuration()),
  );

  /** True once loading finishes with nothing in the thread. */
  readonly isEmptyThread = computed(() => !this.loading() && this.messages().length === 0);

  /**
   * The thread as a flat row list: day dividers interleaved with bubbles, each
   * bubble already carrying its grouping flags and delivery status.
   *
   * Consecutive messages from one sender inside `GROUP_GAP_MS` collapse into a
   * group so the thread reads as conversation turns rather than as one
   * timestamped box per line.
   */
  readonly rows = computed<MessageRow[]>(() => {
    const messages = this.messages();
    const me = this.currentUserId();
    const pending = this.pendingIds();
    const failed = this.failedIds();

    const rows: MessageRow[] = [];
    let lastDayKey = '';

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const at = new Date(message.createdAt);
      const dayKey = at.toDateString();

      if (dayKey !== lastDayKey) {
        rows.push({ key: `day-${dayKey}`, kind: 'day', label: this.dayLabel(at) });
        lastDayKey = dayKey;
      }

      const previous = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;
      const mine = this.isSentByMe(message);

      rows.push({
        key: message._id,
        kind: 'message',
        message,
        mine,
        firstOfGroup: !this.sameGroup(previous, message, dayKey),
        lastOfGroup: !this.sameGroup(message, next, dayKey),
        status: mine ? this.deliveryStatus(message, pending, failed) : undefined,
      });
    }

    return rows;
  });

  private subscriptions: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTypingSentAt = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly messagingService: MessagingService,
    private readonly listingsService: ListingsService,
    private readonly wsService: WebSocketService,
    readonly authService: AuthService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    const inputId = this.conversationIdInput();
    this.conversationId = inputId || this.route.snapshot.paramMap.get('id') || '';
    if (!this.conversationId) return;
    this.initChat();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    const newId = this.conversationIdInput();
    if (newId && newId !== this.conversationId) {
      this.conversationId = newId;
      this.messages.set([]);
      this.loading.set(true);
      // Everything below is per-conversation. The draft in particular used to
      // survive the switch and reappear in the next thread.
      this.messageText = '';
      this.pendingIds.set(new Set());
      this.failedIds.set(new Set());
      this.unseenCount.set(0);
      this.atBottom.set(true);
      this.typingIndicator.set(false);
      this.showAttachMenu.set(false);
      this.showSuggestions.set(false);
      this.cancelImagePreview();
      this.clearSubscriptions();
      this.initChat();
    }
  }

  ngOnDestroy(): void {
    this.clearSubscriptions();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.stopRecording();
  }

  // --- Text messaging ---

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text || this.sending()) return;

    this.sending.set(true);
    this.showSuggestions.set(false);

    const optimisticMsg = this.createOptimisticMessage(`temp-${Date.now()}`, {
      type: 'text',
      content: text,
    });
    this.messages.update((msgs) => [...msgs, optimisticMsg]);
    this.markPending(optimisticMsg._id);
    this.messageText = '';
    this.resetComposerHeight();
    this.jumpToLatest();

    this.messagingService.sendMessage(this.conversationId, text).subscribe({
      next: (saved) => {
        this.replaceOptimisticMessage(optimisticMsg._id, saved);
        this.unmarkDelivery(optimisticMsg._id);
        this.sending.set(false);
        this.tracker.track(TrackingEvent.MESSAGE_SENT, {
          productListingId: this.listing()?._id,
          metadata: { conversationId: this.conversationId },
        });
      },
      error: () => {
        this.markFailed(optimisticMsg._id);
        this.sending.set(false);
      },
    });
  }

  sendQuickReply(text: string): void {
    this.messageText = text;
    this.sendMessage();
  }

  /**
   * Leading-edge throttle: fires immediately on the first keystroke, then at
   * most once per `TYPING_THROTTLE_MS`. Previously this emitted a socket event
   * on every single keypress.
   */
  onTyping(): void {
    const now = Date.now();
    if (now - this.lastTypingSentAt < TYPING_THROTTLE_MS) return;
    this.lastTypingSentAt = now;
    this.wsService.send('typing', { conversationId: this.conversationId });
  }

  /** Enter sends; Shift+Enter inserts a newline. */
  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendMessage();
  }

  /** Grows the composer with its content, up to the CSS max-height. */
  onComposerInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    this.onTyping();
  }

  /** Collapses the composer back to a single row after sending. */
  private resetComposerHeight(): void {
    const el = this.composerInput?.nativeElement;
    if (el) el.style.height = 'auto';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.imagePreview()) {
      this.cancelImagePreview();
      return;
    }
    this.closeOverlays();
  }

  toggleSuggestions(): void {
    this.showSuggestions.update((v) => !v);
    this.showAttachMenu.set(false);
  }

  // --- Attachment menu ---

  toggleAttachMenu(): void {
    this.showAttachMenu.update((v) => !v);
    this.showSuggestions.set(false);
  }

  closeOverlays(): void {
    this.showAttachMenu.set(false);
    this.showSuggestions.set(false);
  }

  // --- Image sharing ---

  openFilePicker(): void {
    this.showAttachMenu.set(false);
    this.fileInput?.nativeElement?.click();
  }

  openCamera(): void {
    this.showAttachMenu.set(false);
    this.cameraInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }

  cancelImagePreview(): void {
    this.imagePreview.set(null);
    this.selectedFile.set(null);
  }

  sendImage(): void {
    const file = this.selectedFile();
    if (!file || this.sending()) return;

    this.sending.set(true);

    const optimisticMsg = this.createOptimisticMessage(`temp-img-${Date.now()}`, {
      type: 'image',
      media: { url: this.imagePreview()!, thumbnailUrl: this.imagePreview()! },
    });
    this.messages.update((msgs) => [...msgs, optimisticMsg]);
    this.cancelImagePreview();
    this.scrollToBottom();

    this.messagingService.sendImageMessage(this.conversationId, file).subscribe({
      next: (saved) => {
        this.replaceOptimisticMessage(optimisticMsg._id, saved);
        this.unmarkDelivery(optimisticMsg._id);
        this.sending.set(false);
      },
      error: () => {
        this.markFailed(optimisticMsg._id);
        this.sending.set(false);
      },
    });
  }

  // --- Voice notes ---

  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.stopAndSendRecording();
    } else {
      await this.startRecording();
    }
  }

  cancelRecording(): void {
    this.stopRecording();
    this.audioChunks = [];
    this.recordingDuration.set(0);
  }

  // --- Location sharing ---

  /**
   * Opens the picker instead of sending immediately.
   *
   * Previously this read the GPS position and posted it straight to the thread,
   * so there was no way to send anywhere other than exactly where you stood,
   * and no chance to check the pin before it went out.
   */
  shareLocation(): void {
    this.showAttachMenu.set(false);
    this.showLocationPicker.set(true);
  }

  closeLocationPicker(): void {
    this.showLocationPicker.set(false);
  }

  /** Sends the point chosen in the picker. */
  onLocationPicked(location: LocationPayload): void {
    this.showLocationPicker.set(false);
    this.sendLocationMessage(location);
  }

  // --- Helpers (called from template — kept minimal) ---

  loadOlderMessages(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage() + 1;

    this.messagingService.getMessages(this.conversationId, nextPage).subscribe({
      next: (res: any) => {
        const msgs = Array.isArray(res) ? res : (res.messages ?? res.data ?? []);
        this.messages.update((existing) => [...[...msgs].reverse(), ...existing]);
        this.currentPage.set(nextPage);
        this.hasMore.set(msgs.length === MESSAGES_PAGE_SIZE);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  /** Used in template trackBy — pure identity check, no computation. */
  isSentByMe(message: Message): boolean {
    const senderId =
      typeof message.senderId === 'object' ? (message.senderId as any)?._id : message.senderId;
    return senderId === this.currentUserId();
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** "Today" / "Yesterday" / a locale date, for the day dividers. */
  private dayLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const sameYear = date.getFullYear() === today.getFullYear();
    return date.toLocaleDateString(
      undefined,
      sameYear
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' },
    );
  }

  /** Two messages belong to one group when the sender and the day match and
   *  they land within `GROUP_GAP_MS` of each other. */
  private sameGroup(a: Message | null, b: Message | null, dayKey: string): boolean {
    if (!a || !b) return false;
    if (this.isSentByMe(a) !== this.isSentByMe(b)) return false;

    const aAt = new Date(a.createdAt);
    const bAt = new Date(b.createdAt);
    if (aAt.toDateString() !== dayKey || bAt.toDateString() !== dayKey) return false;

    return Math.abs(bAt.getTime() - aAt.getTime()) <= GROUP_GAP_MS;
  }

  private deliveryStatus(
    message: Message,
    pending: ReadonlySet<string>,
    failed: ReadonlySet<string>,
  ): MessageDeliveryStatus {
    if (failed.has(message._id)) return 'failed';
    if (pending.has(message._id)) return 'pending';
    return message.isRead ? 'read' : 'sent';
  }

  /** Retries a message that failed to send. Only text can be replayed — the
   *  File/Blob behind a media message is gone by this point. */
  retryFailed(message: Message): void {
    this.dismissFailed(message);
    if (message.type && message.type !== 'text') return;
    this.messageText = message.content;
    this.sendMessage();
  }

  /** Drops a failed message from the thread. */
  dismissFailed(message: Message): void {
    this.removeOptimisticMessage(message._id);
    this.unmarkDelivery(message._id);
  }

  /** Tracks how far the reader is from the newest message. */
  onMessagesScroll(): void {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= NEAR_BOTTOM_PX;
    this.atBottom.set(near);
    if (near) this.unseenCount.set(0);
  }

  /** Jumps to the newest message and clears the unseen counter. */
  jumpToLatest(): void {
    this.unseenCount.set(0);
    this.atBottom.set(true);
    this.scrollToBottom();
  }

  formatDurationValue(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  openLocationInMaps(lat: number, lng: number): void {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  // --- Private helpers ---

  private initChat(): void {
    const user = this.authService.user();
    if (user?._id) {
      this.wsService.connect(user._id);
      this.loadMessages();
      this.listenForRealTimeEvents();
    } else {
      this.authService.fetchCurrentUser().subscribe({
        next: (u) => {
          this.wsService.connect(u._id);
          this.loadMessages();
          this.listenForRealTimeEvents();
        },
        error: () => this.loadMessages(),
      });
    }
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
  }

  private createOptimisticMessage(id: string, overrides: Partial<Message>): Message {
    return {
      _id: id,
      conversationId: this.conversationId,
      senderId: this.currentUserId(),
      type: 'text',
      content: '',
      isRead: false,
      createdAt: new Date(),
      ...overrides,
    };
  }

  private replaceOptimisticMessage(tempId: string, saved: Message): void {
    this.messages.update((msgs) => msgs.map((m) => (m._id === tempId ? ({ ...saved } as any) : m)));
  }

  private removeOptimisticMessage(tempId: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m._id !== tempId));
  }

  private markPending(id: string): void {
    this.pendingIds.update((set) => new Set(set).add(id));
  }

  /**
   * Leaves the failed message in the thread instead of deleting it.
   *
   * The previous behaviour removed the bubble and had already cleared the
   * composer, so a send failure silently destroyed what the user typed with no
   * indication anything had gone wrong.
   */
  private markFailed(id: string): void {
    this.pendingIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.failedIds.update((set) => new Set(set).add(id));
  }

  private unmarkDelivery(id: string): void {
    this.pendingIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.failedIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  private async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: VOICE_MIME_TYPE });
      this.audioChunks = [];
      this.recordingDuration.set(0);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);

      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((d) => d + 1);
      }, 1000);
    } catch {
      // Microphone permission denied or not available
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
    this.mediaRecorder = null;
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    this.isRecording.set(false);
  }

  private stopAndSendRecording(): void {
    if (!this.mediaRecorder) return;

    const duration = this.recordingDuration();

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: VOICE_MIME_TYPE });
      this.audioChunks = [];
      this.sendVoiceNote(blob, duration);
    };

    this.stopRecording();
  }

  private sendVoiceNote(blob: Blob, duration: number): void {
    this.sending.set(true);

    const optimisticMsg = this.createOptimisticMessage(`temp-voice-${Date.now()}`, {
      type: 'voice',
      media: { url: '', duration, mimeType: VOICE_MIME_TYPE },
    });
    this.messages.update((msgs) => [...msgs, optimisticMsg]);
    this.markPending(optimisticMsg._id);
    this.jumpToLatest();

    this.messagingService.sendVoiceMessage(this.conversationId, blob, duration).subscribe({
      next: (saved) => {
        this.replaceOptimisticMessage(optimisticMsg._id, saved);
        this.unmarkDelivery(optimisticMsg._id);
        this.sending.set(false);
      },
      error: () => {
        this.markFailed(optimisticMsg._id);
        this.sending.set(false);
      },
    });
  }

  /** Posts an already-resolved point. Acquiring it is the picker's job. */
  private sendLocationMessage(location: LocationPayload): void {
    this.sending.set(true);

    const optimisticMsg = this.createOptimisticMessage(`temp-loc-${Date.now()}`, {
      type: 'location',
      location,
    });
    this.messages.update((msgs) => [...msgs, optimisticMsg]);
    this.markPending(optimisticMsg._id);
    this.jumpToLatest();

    this.messagingService
      .sendRichMessage(this.conversationId, { type: 'location', location })
      .subscribe({
        next: (saved) => {
          this.replaceOptimisticMessage(optimisticMsg._id, saved);
          this.unmarkDelivery(optimisticMsg._id);
          this.sending.set(false);
        },
        error: () => {
          this.markFailed(optimisticMsg._id);
          this.sending.set(false);
        },
      });
  }

  private loadMessages(): void {
    this.messagingService.getMessages(this.conversationId, 1).subscribe({
      next: (res: any) => {
        const msgs = Array.isArray(res) ? res : (res.messages ?? res.data ?? []);
        this.messages.set([...msgs].reverse());
        this.hasMore.set(msgs.length === MESSAGES_PAGE_SIZE);
        this.loading.set(false);
        this.scrollToBottom();
        this.messagingService.markAsRead(this.conversationId).subscribe();
        this.loadConversationListing();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadConversationListing(): void {
    this.messagingService.getConversations().subscribe({
      next: (res: any) => {
        const conversations = Array.isArray(res) ? res : (res.data ?? []);
        const conv = conversations.find((c: any) => c._id === this.conversationId);
        const listingId = conv?.productListingId?._id || conv?.productListingId;
        if (listingId) {
          this.listingsService.getById(listingId).subscribe({
            next: (listing) => this.listing.set(listing),
          });
        }
      },
    });
  }

  private listenForRealTimeEvents(): void {
    const msgSub = this.wsService.on('newMessage').subscribe((data) => {
      const msg = data as Message;
      if (msg.conversationId === this.conversationId) {
        this.messages.update((msgs) => {
          const exists = msgs.some((m) => m._id === msg._id);
          if (exists) return msgs;
          const filtered = msgs.filter(
            (m) =>
              !(
                m._id.startsWith('temp-') &&
                m.content === msg.content &&
                m.senderId === msg.senderId
              ),
          );
          return [...filtered, msg];
        });
        // Only follow the thread when the reader is already at the bottom.
        // Unconditional scrolling yanked them out of the history they were
        // reading; otherwise the unseen counter surfaces a "jump to latest" pill.
        if (this.atBottom() || this.isSentByMe(msg)) {
          this.scrollToBottom();
        } else {
          this.unseenCount.update((n) => n + 1);
        }
        this.wsService.send('markRead', { conversationId: this.conversationId });
      }
    });

    const typingSub = this.wsService.on('userTyping').subscribe((data) => {
      const typingData = data as { conversationId: string; userId: string };
      if (
        typingData.conversationId === this.conversationId &&
        typingData.userId !== this.currentUserId()
      ) {
        this.typingIndicator.set(true);
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.typingIndicator.set(false), TYPING_TIMEOUT_MS);
      }
    });

    const readSub = this.wsService.on('messagesRead').subscribe((data) => {
      const readData = data as { conversationId: string };
      if (readData.conversationId === this.conversationId) {
        this.messages.update((msgs) => msgs.map((m) => ({ ...m, isRead: true })));
      }
    });

    this.subscriptions.push(msgSub, typingSub, readSub);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, SCROLL_DELAY_MS);
  }
}

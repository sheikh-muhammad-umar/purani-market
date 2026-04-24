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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { ListingsService } from '../../../core/services/listings.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Message, Listing } from '../../../core/models';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { QUICK_REPLIES, PLACEHOLDER_IMAGE } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import {
  ACCEPTED_IMAGE_TYPES,
  VOICE_MIME_TYPE,
  MESSAGES_PAGE_SIZE,
  TYPING_TIMEOUT_MS,
  SCROLL_DELAY_MS,
  LIVE_LOCATION_DURATION_MIN,
  SKELETON_ITEMS,
  WAVEFORM_BARS,
} from '../messaging.constants';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ListingUrlPipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  // Input for split-pane mode
  conversationIdInput = input<string | null>(null);
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

  messageText = '';
  conversationId = '';

  readonly quickReplies = QUICK_REPLIES;
  readonly ROUTES = ROUTES;
  readonly ACCEPTED_IMAGE_TYPES = ACCEPTED_IMAGE_TYPES;
  readonly SKELETON_ITEMS = SKELETON_ITEMS;
  readonly WAVEFORM_BARS = WAVEFORM_BARS;

  readonly currentUserId = computed(() => this.authService.user()?._id ?? '');

  /** Precomputed: whether the chat is disabled (listing not active). */
  readonly chatDisabled = computed(() => {
    const l = this.listing();
    return l != null && l.status !== 'active';
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

  private subscriptions: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
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
    this.messageText = '';
    this.scrollToBottom();

    this.messagingService.sendMessage(this.conversationId, text).subscribe({
      next: (saved) => {
        this.replaceOptimisticMessage(optimisticMsg._id, saved);
        this.sending.set(false);
        this.tracker.track(TrackingEvent.MESSAGE_SENT, {
          productListingId: this.listing()?._id,
          metadata: { conversationId: this.conversationId },
        });
      },
      error: () => {
        this.removeOptimisticMessage(optimisticMsg._id);
        this.sending.set(false);
      },
    });
  }

  sendQuickReply(text: string): void {
    this.messageText = text;
    this.sendMessage();
  }

  onTyping(): void {
    this.wsService.send('typing', { conversationId: this.conversationId });
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
        this.sending.set(false);
      },
      error: () => {
        this.removeOptimisticMessage(optimisticMsg._id);
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

  shareLocation(): void {
    this.showAttachMenu.set(false);
    this.sendLocationMessage(false);
  }

  shareLiveLocation(): void {
    this.showAttachMenu.set(false);
    this.sendLocationMessage(true);
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
    this.scrollToBottom();

    this.messagingService.sendVoiceMessage(this.conversationId, blob, duration).subscribe({
      next: (saved) => {
        this.replaceOptimisticMessage(optimisticMsg._id, saved);
        this.sending.set(false);
      },
      error: () => {
        this.removeOptimisticMessage(optimisticMsg._id);
        this.sending.set(false);
      },
    });
  }

  private sendLocationMessage(isLive: boolean): void {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.sending.set(true);
        const location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...(isLive && { isLive: true, liveDurationMinutes: LIVE_LOCATION_DURATION_MIN }),
        };

        const optimisticMsg = this.createOptimisticMessage(`temp-loc-${Date.now()}`, {
          type: 'location',
          location,
        });
        this.messages.update((msgs) => [...msgs, optimisticMsg]);
        this.scrollToBottom();

        this.messagingService
          .sendRichMessage(this.conversationId, { type: 'location', location })
          .subscribe({
            next: (saved) => {
              this.replaceOptimisticMessage(optimisticMsg._id, saved);
              this.sending.set(false);
            },
            error: () => {
              this.removeOptimisticMessage(optimisticMsg._id);
              this.sending.set(false);
            },
          });
      },
      () => {
        // Location permission denied
      },
    );
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
        this.scrollToBottom();
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

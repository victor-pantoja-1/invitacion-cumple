import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DEFAULT_EVENT } from '../../config/event.config';
import { InvitationApiService } from '../../core/invitation-api.service';
import { TokenStoreService } from '../../core/token-store.service';
import { CountdownValue, EventConfig, RsvpRecord } from '../../models/invitation.models';

@Component({
  selector: 'app-invitation',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationComponent implements OnInit {
  private readonly api = inject(InvitationApiService);
  private readonly tokenStore = inject(TokenStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly scene = signal(0);
  readonly opened = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly event = signal<EventConfig>(DEFAULT_EVENT);
  readonly rsvp = signal<RsvpRecord | null>(null);
  readonly countdown = signal<CountdownValue>({ days: 0, hours: 0, minutes: 0, seconds: 0, finished: false });
  readonly notice = signal('');
  readonly invalidLink = signal(false);
  readonly portraitFailed = signal(false);
  readonly musicPlaying = signal(false);
  readonly configured = this.api.configured;
  readonly petals = Array.from({ length: 12 }, (_, index) => index);

  readonly rsvpForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    attending: [true, Validators.required],
    companions: [0, [Validators.required, Validators.min(0), Validators.max(6)]],
  });

  private token = '';
  private personalized = false;
  private pendingIdempotencyKey = '';
  private audio: HTMLAudioElement | null = null;

  async ngOnInit(): Promise<void> {
    const routeToken = this.route.snapshot.paramMap.get('token');
    this.personalized = Boolean(routeToken);
    if (routeToken && !/^[a-f0-9]{64}$/i.test(routeToken)) {
      this.invalidLink.set(true);
      this.loading.set(false);
      return;
    }
    this.token = routeToken ?? this.tokenStore.getOrCreate();
    await this.loadInvitation();
    this.updateCountdown();
    const timer = window.setInterval(() => this.updateCountdown(), 1000);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      this.audio?.pause();
    });
    this.rsvpForm.controls.attending.valueChanges.subscribe((attending) => {
      if (!attending) this.rsvpForm.controls.companions.setValue(0);
    });
  }

  private async loadInvitation(): Promise<void> {
    try {
      const state = await this.api.resolve(this.token, this.personalized);
      this.event.set({ ...DEFAULT_EVENT, ...state.event });
      this.rsvp.set(state.rsvp);
      if (state.rsvp) {
        this.rsvpForm.setValue({
          name: state.rsvp.name,
          attending: state.rsvp.attending,
          companions: state.rsvp.companions,
        });
        this.scene.set(5);
      }
    } catch (error) {
      if (this.personalized && (error as Error).name === 'INVITATION_NOT_FOUND') {
        this.invalidLink.set(true);
      } else {
        this.notice.set('No pudimos conectar con el servidor. Puedes recorrer la invitación y volver a intentar más tarde.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  openInvitation(): void {
    if (this.opened()) return;
    this.startMusic();
    this.opened.set(true);
    window.setTimeout(() => this.goTo(1), 850);
  }

  goTo(index: number): void {
    const nextScene = Math.max(0, Math.min(index, 5));
    if (nextScene === 0) this.opened.set(false);
    this.scene.set(nextScene);
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  next(): void {
    this.goTo(this.scene() + 1);
  }

  previous(): void {
    this.goTo(this.scene() - 1);
  }

  skipStory(): void {
    this.goTo(3);
  }

  async submitRsvp(): Promise<void> {
    this.notice.set('');
    if (this.rsvpForm.invalid || this.saving()) {
      this.rsvpForm.markAllAsTouched();
      return;
    }
    if (!this.event().rsvpOpen) {
      this.notice.set('Las confirmaciones están cerradas por el momento.');
      return;
    }
    if (!this.pendingIdempotencyKey) this.pendingIdempotencyKey = crypto.randomUUID();
    this.saving.set(true);
    const value = this.rsvpForm.getRawValue();
    try {
      const saved = await this.api.saveRsvp({
        token: this.token,
        personalized: this.personalized,
        name: value.name.trim(),
        attending: value.attending,
        companions: value.attending ? value.companions : 0,
        idempotencyKey: this.pendingIdempotencyKey,
      });
      this.rsvp.set(saved);
      this.pendingIdempotencyKey = '';
      this.goTo(5);
    } catch (error) {
      this.notice.set(
        (error as Error).message === 'DEMO_MODE'
          ? 'Modo demostración: configura Supabase para guardar una respuesta real.'
          : 'No pudimos guardar tu respuesta. Revisa tu conexión y vuelve a intentarlo; no se duplicará.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  editRsvp(): void {
    this.notice.set('');
    this.goTo(4);
  }

  openMap(): void {
    window.open(this.event().mapsUrl, '_blank', 'noopener,noreferrer');
  }

  addToGoogleCalendar(): void {
    const event = this.event();
    const start = new Date(event.startsAt);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${format(start)}/${format(end)}`,
      details: 'Será un día muy especial. ¡Te esperamos!',
      location: event.address,
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  downloadCalendar(): void {
    const event = this.event();
    const start = new Date(event.startsAt);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const content = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitacion Cumple//ES', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', `UID:${crypto.randomUUID()}@invitacion-cumple`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape(event.address)}`, 'DESCRIPTION:Será un día muy especial. ¡Te esperamos!',
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = 'cumpleanos-08-noviembre-2026.ics';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  toggleMusic(): void {
    const audio = this.ensureAudio();
    if (!audio) return;
    if (this.musicPlaying()) {
      audio.pause();
      this.musicPlaying.set(false);
      this.saveMusicPreference('off');
    } else {
      void audio.play().then(() => {
        this.musicPlaying.set(true);
        this.saveMusicPreference('on');
      }).catch(() => undefined);
    }
  }

  onPortraitError(): void {
    this.portraitFailed.set(true);
  }

  totalPeople(): number {
    const response = this.rsvp();
    return response?.attending ? response.companions + 1 : 0;
  }

  trackPetal(index: number): number {
    return index;
  }

  private startMusic(): void {
    const audio = this.ensureAudio();
    if (!audio || this.musicPlaying()) return;
    void audio.play().then(() => {
      this.musicPlaying.set(true);
      this.saveMusicPreference('on');
    }).catch(() => undefined);
  }

  private ensureAudio(): HTMLAudioElement | null {
    const url = this.event().musicUrl;
    if (!url) return null;
    if (!this.audio) {
      this.audio = new Audio(url);
      this.audio.loop = true;
      this.audio.preload = 'none';
    }
    return this.audio;
  }

  private saveMusicPreference(value: 'on' | 'off'): void {
    try { localStorage.setItem('birthday-music', value); } catch { /* Storage can be unavailable in private mode. */ }
  }

  private updateCountdown(): void {
    const remaining = new Date(this.event().startsAt).getTime() - Date.now();
    if (remaining <= 0) {
      this.countdown.set({ days: 0, hours: 0, minutes: 0, seconds: 0, finished: true });
      return;
    }
    this.countdown.set({
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1000),
      finished: false,
    });
  }
}

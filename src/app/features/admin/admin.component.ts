import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InvitationApiService } from '../../core/invitation-api.service';
import { AdminInvitation, AdminStats, EventConfig } from '../../models/invitation.models';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(InvitationApiService);
  private readonly fb = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly signedIn = signal(false);
  readonly error = signal('');
  readonly stats = signal<AdminStats | null>(null);
  readonly invitations = signal<AdminInvitation[]>([]);
  readonly event = signal<EventConfig | null>(null);
  readonly query = signal('');
  readonly statusFilter = signal('all');
  readonly createdLink = signal('');

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly inviteForm = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(100)]],
    kind: ['individual', Validators.required],
    maxCompanions: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
  });

  async ngOnInit(): Promise<void> {
    const session = (await this.api.supabase?.auth.getSession())?.data.session;
    this.signedIn.set(Boolean(session));
    if (session) await this.loadDashboard(session.access_token);
    else this.loading.set(false);
  }

  get filteredInvitations(): AdminInvitation[] {
    const search = this.query().trim().toLocaleLowerCase('es');
    const status = this.statusFilter();
    return this.invitations().filter((invitation) => {
      const matchesSearch = !search || (invitation.label ?? '').toLocaleLowerCase('es').includes(search) || invitation.rsvp?.name.toLocaleLowerCase('es').includes(search);
      const currentStatus = invitation.rsvp ? (invitation.rsvp.attending ? 'attending' : 'declined') : 'pending';
      return matchesSearch && (status === 'all' || status === currentStatus);
    });
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid || this.busy()) {
      this.loginForm.markAllAsTouched();
      return;
    }
    if (!this.api.supabase) {
      this.error.set('Configura Supabase para acceder al panel.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const { email, password } = this.loginForm.getRawValue();
    const result = await this.api.supabase.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session) {
      this.error.set('No pudimos iniciar sesión. Revisa tus credenciales.');
      this.busy.set(false);
      return;
    }
    this.signedIn.set(true);
    await this.loadDashboard(result.data.session.access_token);
    this.busy.set(false);
  }

  async logout(): Promise<void> {
    await this.api.supabase?.auth.signOut();
    this.signedIn.set(false);
    this.stats.set(null);
    this.invitations.set([]);
  }

  async createInvitation(): Promise<void> {
    if (this.inviteForm.invalid || this.busy()) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    const token = await this.accessToken();
    if (!token) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.api.createInvitation(token, this.inviteForm.getRawValue());
      this.createdLink.set(`${window.location.origin}/i/${result.urlToken}`);
      this.inviteForm.reset({ label: '', kind: 'individual', maxCompanions: 0 });
      await this.loadDashboard(token);
    } catch (error) {
      this.error.set(this.friendlyError(error));
    } finally {
      this.busy.set(false);
    }
  }

  async removeInvitation(invitation: AdminInvitation): Promise<void> {
    if (!window.confirm(`¿Eliminar la invitación de ${invitation.label ?? 'este invitado'}? Esta acción no se puede deshacer.`)) return;
    const token = await this.accessToken();
    if (!token) return;
    this.busy.set(true);
    try {
      await this.api.deleteInvitation(token, invitation.id);
      await this.loadDashboard(token);
    } catch (error) {
      this.error.set(this.friendlyError(error));
    } finally {
      this.busy.set(false);
    }
  }

  async copyLink(link = this.createdLink()): Promise<void> {
    await navigator.clipboard.writeText(link);
  }

  whatsappShareLink(link: string): string {
    return `https://wa.me/?text=${encodeURIComponent(`Tengo una invitación muy especial para ti: ${link}`)}`;
  }

  exportCsv(): void {
    const safe = (value: string | number | boolean | null | undefined): string => {
      let text = String(value ?? '');
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Invitación', 'Nombre', 'Estado', 'Acompañantes', 'Última actualización'],
      ...this.filteredInvitations.map((item) => [
        item.label ?? '', item.rsvp?.name ?? '',
        item.rsvp ? (item.rsvp.attending ? 'Asistirá' : 'No asistirá') : 'Pendiente',
        item.rsvp?.companions ?? 0, item.rsvp?.updatedAt ?? '',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(safe).join(',')).join('\r\n')}`;
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = href;
    anchor.download = `asistentes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  updateSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  updateFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  private async loadDashboard(token: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.adminDashboard(token);
      this.stats.set(data.stats);
      this.invitations.set(data.invitations);
      this.event.set(data.event);
    } catch (error) {
      this.error.set(this.friendlyError(error));
      if ((error as Error).name === 'FORBIDDEN') await this.logout();
    } finally {
      this.loading.set(false);
    }
  }

  private async accessToken(): Promise<string | null> {
    const session = (await this.api.supabase?.auth.getSession())?.data.session;
    if (!session) {
      this.signedIn.set(false);
      this.error.set('Tu sesión ha finalizado. Vuelve a iniciar sesión.');
      return null;
    }
    return session.access_token;
  }

  private friendlyError(error: unknown): string {
    const value = error as Error;
    if (value.name === 'FORBIDDEN') return 'Tu cuenta no tiene permisos de administrador.';
    return value.message || 'No se pudo completar la operación.';
  }
}

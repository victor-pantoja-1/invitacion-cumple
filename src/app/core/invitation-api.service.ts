import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { DEFAULT_EVENT } from '../config/event.config';
import {
  AdminInvitation,
  AdminStats,
  EventConfig,
  InvitationState,
  RsvpPayload,
  RsvpRecord,
} from '../models/invitation.models';

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
  code?: string;
}

@Injectable({ providedIn: 'root' })
export class InvitationApiService {
  readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);
  private readonly client: SupabaseClient | null = this.configured
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

  async resolve(token: string, personalized: boolean): Promise<InvitationState> {
    if (!this.configured) {
      return { event: DEFAULT_EVENT, rsvp: null, invitationType: personalized ? 'personalized' : 'general' };
    }
    return this.request<InvitationState>('invitation-api', {
      action: 'resolve', token, personalized,
    });
  }

  async saveRsvp(payload: RsvpPayload): Promise<RsvpRecord> {
    if (!this.configured) throw new Error('DEMO_MODE');
    return this.request<RsvpRecord>('invitation-api', { action: 'save', ...payload });
  }

  get supabase(): SupabaseClient | null {
    return this.client;
  }

  async adminDashboard(accessToken: string): Promise<{ stats: AdminStats; invitations: AdminInvitation[]; event: EventConfig }> {
    return this.request('admin-api', { action: 'dashboard' }, accessToken);
  }

  async createInvitation(accessToken: string, input: { label: string; kind: string; maxCompanions: number }): Promise<{ urlToken: string }> {
    return this.request('admin-api', { action: 'create-invitation', ...input }, accessToken);
  }

  async deleteInvitation(accessToken: string, id: string): Promise<void> {
    await this.request('admin-api', { action: 'delete-invitation', id }, accessToken);
  }

  private async request<T>(functionName: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
    const response = await fetch(`${environment.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: environment.supabasePublishableKey,
        Authorization: `Bearer ${accessToken ?? environment.supabasePublishableKey}`,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!response.ok || payload.error) {
      const error = new Error(payload.error ?? 'No se pudo completar la solicitud.');
      error.name = payload.code ?? `HTTP_${response.status}`;
      throw error;
    }
    return payload.data as T;
  }
}

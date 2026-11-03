export interface EventConfig {
  id: string;
  title: string;
  celebrantName: string | null;
  startsAt: string;
  timezone: string;
  address: string;
  mapsUrl: string;
  photoUrl: string;
  musicUrl: string | null;
  maxGuests: number;
  rsvpOpen: boolean;
  narrative: {
    opening: string;
    openingDetail: string;
    story: string[];
    invitation: string;
  };
}

export interface RsvpRecord {
  name: string;
  attending: boolean;
  companions: number;
  updatedAt: string;
}

export interface InvitationState {
  event: EventConfig;
  rsvp: RsvpRecord | null;
  invitationType: 'general' | 'personalized';
}

export interface RsvpPayload {
  token: string;
  personalized: boolean;
  name: string;
  attending: boolean;
  companions: number;
  idempotencyKey: string;
}

export interface CountdownValue {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
}

export interface AdminStats {
  invitations: number;
  responded: number;
  attending: number;
  declined: number;
  companions: number;
  totalPeople: number;
  pending: number;
}

export interface AdminInvitation {
  id: string;
  label: string | null;
  kind: string;
  maxCompanions: number | null;
  createdAt: string;
  rsvp: RsvpRecord | null;
}

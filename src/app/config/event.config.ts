import { EventConfig } from '../models/invitation.models';

export const DEFAULT_EVENT: EventConfig = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cumpleaños',
  celebrantName: null,
  startsAt: '2026-11-07T10:00:00-05:00',
  timezone: 'America/Lima',
  address: 'Casa de Campo - Campiña de Moche',
  mapsUrl: 'https://maps.app.goo.gl/GJUhJmogusQeqKe96',
  photoUrl: '/assets/images/cumpleanera.webp',
  musicUrl: '/assets/audio/cancion.mp3',
  maxGuests: 6,
  rsvpOpen: true,
  narrative: {
    opening: 'Hay momentos que merecen celebrarse…',
    openingDetail: 'Y nada me haría más feliz que compartir este día tan especial contigo.',
    story: [
      'La vida está llena de momentos especiales…',
      'Y los más bonitos son aquellos que compartimos con las personas que queremos.',
    ],
    invitation: 'Será un gran placer compartir contigo este día tan especial, donde celebraremos la alegría de vivir y los nuevos comienzos.',
  },
};

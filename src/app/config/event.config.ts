import { EventConfig } from '../models/invitation.models';

export const DEFAULT_EVENT: EventConfig = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cumpleaños',
  celebrantName: null,
  startsAt: '2026-11-06T13:00:00-05:00',
  timezone: 'America/Lima',
  address: 'Mz. L, lote 5, Urb. Villa Santa María, Trujillo, Perú',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mz.%20L%2C%20lote%205%2C%20Urb.%20Villa%20Santa%20Mar%C3%ADa%2C%20Trujillo%2C%20Per%C3%BA',
  photoUrl: '/assets/images/cumpleanera.webp',
  musicUrl: null,
  maxGuests: 4,
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

import { expect, Page, test } from '@playwright/test';

const event = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Cumpleaños', celebrantName: null,
  startsAt: '2026-11-06T13:00:00-05:00', timezone: 'America/Lima',
  address: 'Mz. L, lote 5, Urb. Villa Santa María, Trujillo, Perú',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Trujillo',
  photoUrl: '/assets/images/cumpleanera.webp', musicUrl: null, maxGuests: 4, rsvpOpen: true,
  narrative: {
    opening: 'Hay momentos que merecen celebrarse…',
    openingDetail: 'Y nada me haría más feliz que compartir este día tan especial contigo.',
    story: ['La vida está llena de momentos especiales…', 'Y los más bonitos son aquellos que compartimos con las personas que queremos.'],
    invitation: 'Será un gran placer compartir contigo este día tan especial, donde celebraremos la alegría de vivir y los nuevos comienzos.',
  },
};

async function mockApi(page: Page, returning = false) {
  let saved = returning ? { name: 'María', attending: true, companions: 1, updatedAt: new Date().toISOString() } : null;
  await page.route('**/functions/v1/invitation-api', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'save') saved = { name: body.name, attending: body.attending, companions: body.companions, updatedAt: new Date().toISOString() };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: body.action === 'resolve' ? { event, rsvp: saved, invitationType: 'general' } : saved }) });
  });
}

test.beforeEach(async ({ page }) => mockApi(page));

test('opens the envelope and lets the visitor skip to event details', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hay momentos/ })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir invitación' }).click();
  await expect(page.getByRole('heading', { name: /La vida está llena/ })).toBeVisible();
  await page.getByRole('button', { name: 'Saltar historia' }).click();
  await expect(page.getByRole('heading', { name: /Nos vemos/ })).toBeVisible();
  await expect(page.getByText('Viernes, 06 de noviembre')).toBeVisible();
  await expect(page.getByText('1:00 p. m.')).toBeVisible();
});

test('validates and saves a positive RSVP only after the server responds', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver detalles' }).click();
  await page.getByRole('button', { name: /Confirmar asistencia/ }).click();
  await page.getByRole('button', { name: /Confirmar mi asistencia/ }).click();
  await expect(page.getByText(/Escribe un nombre válido/)).toBeVisible();
  await page.getByLabel('Nombre y apellido').fill('María Pérez');
  await page.getByLabel('Número de acompañantes').selectOption('2');
  await page.getByRole('button', { name: /Confirmar mi asistencia/ }).click();
  await expect(page.getByRole('heading', { name: /Qué alegría, María Pérez/ })).toBeVisible();
  await expect(page.getByText('3 personas confirmadas')).toBeVisible();
});

test('restores a previous response and allows editing it', async ({ page }) => {
  await page.unroute('**/functions/v1/invitation-api');
  await mockApi(page, true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Qué alegría, María/ })).toBeVisible();
  await page.getByRole('button', { name: 'Modificar mi respuesta' }).click();
  await expect(page.getByLabel('Nombre y apellido')).toHaveValue('María');
});

test('rejects malformed personalized links without calling the backend', async ({ page }) => {
  await page.goto('/i/token-invalido');
  await expect(page.getByRole('heading', { name: /no es válida/ })).toBeVisible();
});

test('shows a retryable message when saving fails', async ({ page }) => {
  await page.unroute('**/functions/v1/invitation-api');
  await page.route('**/functions/v1/invitation-api', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'save') await route.abort('failed');
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { event, rsvp: null, invitationType: 'general' } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver detalles' }).click();
  await page.getByRole('button', { name: /Confirmar asistencia/ }).click();
  await page.getByLabel('Nombre y apellido').fill('Ana Torres');
  await page.getByRole('button', { name: /Confirmar mi asistencia/ }).click();
  await expect(page.getByText(/No pudimos guardar tu respuesta/)).toBeVisible();
});

test('never creates horizontal overflow at representative widths', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test('keeps the admin dashboard behind authentication', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Panel administrativo' })).toBeVisible();
  await expect(page.getByText('Lista de invitados')).not.toBeVisible();
});

import { test, expect, type Page, type TestInfo } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Browser checks run only against disposable CI services.');
const tourPath = '/es/tours/tour-islas-de-los-uros-y-taquile-full-day';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => { const errors: string[] = []; browserErrors.set(page, errors); page.on("pageerror", error => errors.push(error.message)); });
const timings: { test: string; action: string; milliseconds: number }[] = [];
async function measured(info: TestInfo, action: string, work: () => Promise<void>) {
  const start = performance.now(); await test.step(action, work);
  timings.push({ test: info.title, action, milliseconds: Math.round(performance.now() - start) });
}
async function navigationMetric(page: Page, info: TestInfo) {
  const metric = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return n ? { ttfb_ms: n.responseStart - n.requestStart, dom_ms: n.domContentLoadedEventEnd - n.startTime, load_ms: n.loadEventEnd > 0 ? n.loadEventEnd - n.startTime : null } : null;
  });
  await info.attach('navigation-timing.json', { body: JSON.stringify({ environment: 'isolated-ci-localhost-chromium', metric }), contentType: 'application/json' });
}
test.afterEach(async ({ page }, info) => {
  await navigationMetric(page, info);
  const images = await page.evaluate(() => Array.from(document.images).map(image => ({ src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0, pending: !image.complete })));
  await info.attach("image-load-diagnostics.json", { body: JSON.stringify(images), contentType: "application/json" });
  await info.attach("browser-errors.json", { body: JSON.stringify(browserErrors.get(page) ?? []), contentType: "application/json" });
  expect(browserErrors.get(page) ?? [], "No uncaught client error").toEqual([]);
  await info.attach('user-action-timings.json', { body: JSON.stringify(timings.filter(t => t.test === info.title), null, 2), contentType: 'application/json' });
});

test('Home prioritizes products; hero controls and featured tabs work', async ({ page }, info) => {
  await measured(info, 'Home ready', async () => { await page.goto('/es'); await expect(page.locator('#hero-title')).toBeVisible(); });
  const positions = await page.evaluate(() => ['destinos-title', 'paquetes-title', 'enlaces-oficiales'].map(id => document.getElementById(id)!.getBoundingClientRect().top + scrollY));
  expect(positions[0]).toBeLessThan(positions[1]); expect(positions[1]).toBeLessThan(positions[2]);
  const controls = page.getByRole('group', { name: 'Destinos del banner principal' });
  await measured(info, 'Select Machu Picchu banner', async () => { await controls.getByRole('button', { name: 'Mostrar Machu Picchu', exact: true }).click(); await expect(controls.getByRole('button', { name: 'Mostrar Machu Picchu', exact: true })).toHaveAttribute('aria-pressed', 'true'); });
  await measured(info, 'Pause and resume banner', async () => {
    await controls.getByRole('button', { name: 'Pausar animación y carrusel', exact: true }).click();
    await expect(page.locator('[data-effect][data-active="false"]').first()).toBeVisible();
    await controls.getByRole('button', { name: 'Reproducir animación y carrusel', exact: true }).click();
    await expect(page.locator('[data-effect][data-active="true"]').first()).toBeVisible();
  });
  await controls.getByRole('button', { name: 'Banner anterior', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'Mostrar Lago Titicaca', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const tabs = page.getByRole('tablist', { name: 'Filtrar tours destacados' });
  for (const label of ['Todos', 'Altiplano y Titicaca', 'Machu Picchu', 'Multidestino']) await measured(info, `Featured tab ${label}`, async () => {
    const tab = tabs.getByRole('tab', { name: label, exact: true }); await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true');
  });
  await tabs.getByRole('tab', { name: 'Multidestino', exact: true }).press('Home');
  await expect(tabs.getByRole('tab', { name: 'Todos', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('home-products.png'), fullPage: true });
});

test('Search destination, traveler controls and submit use chosen parameters', async ({ page }, info) => {
  await page.goto('/es'); const search = page.getByRole('search', { name: 'Buscar tours' });
  await search.getByRole('combobox').fill('Puno');
  await page.getByRole('option', { name: /Puno/i }).first().click();
  await search.getByRole('button', { name: /^Viajeros/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Elegir viajeros' });
  await dialog.getByRole('button', { name: 'Agregar un adulto', exact: true }).click();
  await dialog.getByRole('button', { name: 'Agregar un niño', exact: true }).click();
  await dialog.getByRole('button', { name: 'Listo', exact: true }).click();
  await measured(info, 'Search tours', async () => { await search.getByRole('button', { name: 'Buscar', exact: true }).click(); await expect(page).toHaveURL(/\/es\/tours\?/); });
  const url = new URL(page.url()); expect(url.searchParams.get('adultos')).toBe('3'); expect(url.searchParams.get('ninos')).toBe('1'); expect(url.searchParams.get('destino')).toBeTruthy();
  await expect(page.locator('main h1')).toBeVisible();
});

test('Favorites persist and comparison actions operate on selected tours', async ({ page }, info) => {
  await page.goto('/es/tours');
  const save = page.getByRole('button', { name: /^Guardar .* en favoritos$/ }).first();
  await measured(info, 'Save favorite', async () => { await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'true'); });
  await page.reload(); await expect(save).toHaveAttribute('aria-pressed', 'true');
  const compare = page.getByRole('button', { name: /^Comparar / });
  await compare.nth(0).click(); await compare.nth(1).click();
  const tray = page.getByRole('region', { name: 'Comparador de tours' });
  await measured(info, 'Open selected comparison', async () => { await tray.getByRole('link', { name: 'Comparar 2', exact: true }).click(); await expect(page).toHaveURL(/\/es\/comparar/); });
  await expect(page.locator('main h1')).toBeVisible();
  await page.goto('/es/favoritos');
  const saved = page.getByRole('button', { name: /^Guardar .* en favoritos$/ }).first();
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  await saved.click();
  await expect(page.getByRole('heading', { name: 'Aún no tienes favoritos', exact: true })).toBeVisible();
});

test('Date, booking, cart edit/remove/undo and checkout validation work', async ({ page }, info) => {
  await page.goto(tourPath); const booking = page.locator('#reservar-panel');
  await expect(booking.getByRole('button', { name: 'Agregar al carrito', exact: true })).toBeVisible();
  await booking.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  await expect(booking.getByRole('alert')).toContainText('Elige una fecha');
  await measured(info, 'Choose available departure', async () => {
    const date = booking.locator('button[data-date]:not([aria-disabled="true"])').first(); await expect(date).toBeVisible(); await date.click();
    await expect(date.locator('..')).toHaveAttribute('aria-selected', 'true');
  });
  await booking.getByRole('button', { name: 'Agregar un adulto', exact: true }).click();
  await booking.getByRole('button', { name: 'Quitar un adulto', exact: true }).click();
  await measured(info, 'Add tour to cart', async () => { await booking.getByRole('button', { name: 'Agregar al carrito', exact: true }).click(); await expect(booking.getByRole('button', { name: 'Agregado', exact: true })).toBeVisible(); });
  await page.goto('/es/carrito'); await expect(page.getByRole('button', { name: 'Editar', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
  await page.getByRole('button', { name: /^Quitar .* del carrito$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Tu carrito está vacío', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar', exact: true }).first()).toBeVisible();
  await measured(info, 'Open checkout', async () => { await page.getByRole('link', { name: 'Continuar con la reserva', exact: true }).first().click(); await expect(page.getByRole('heading', { name: 'Tus datos', exact: true })).toBeVisible(); });
  await page.getByRole('button', { name: 'Continuar a viajeros', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByLabel('Nombres', { exact: true }).fill('Viajero'); await page.getByLabel('Apellidos', { exact: true }).fill('Prueba');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('traveler@peruwonderstours.test');
  await page.getByLabel('Celular (WhatsApp)', { exact: true }).fill('924278597');
  await page.getByLabel('País de residencia', { exact: true }).selectOption('Perú');
  await measured(info, 'Validated contact advances to travelers', async () => { await page.getByRole('button', { name: 'Continuar a viajeros', exact: true }).click(); await expect(page.getByRole('button', { name: 'Continuar al pago', exact: true })).toBeVisible(); });
  await page.screenshot({ path: info.outputPath('checkout-travelers.png'), fullPage: true });
});

test('Official resource controls, WhatsApp destination and complaint access work', async ({ page }, info) => {
  await page.goto('/es');
  const resources = page.getByRole('navigation', { name: 'Enlaces oficiales', exact: true }); await resources.scrollIntoViewIfNeeded();
  await measured(info, 'Pause official resources', async () => { await resources.getByRole('button', { name: 'Pausar carrusel', exact: true }).click(); await expect(resources.locator('[data-running]')).toHaveAttribute('data-running', 'false'); });
  await resources.getByRole('button', { name: 'Reanudar carrusel', exact: true }).click();
  const wa = page.locator('a[href="https://wa.me/51924278597"]').filter({ has: page.locator('img[src="/icons/whatsapp.svg"]') });
  await expect(wa).toHaveAttribute('target', '_blank'); await expect(wa).toHaveAccessibleName(/WhatsApp/);
  await page.goto('/es/libro-de-reclamaciones'); await expect(page.locator('main h1')).toContainText('Libro de Reclamaciones');
  await page.getByRole('link', { name: "Consultar mi reclamo", exact: true }).first().click(); await expect(page).toHaveURL(/\/consulta/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('complaint-consultation.png'), fullPage: true });
});

test('Contact submission records a fixture message without external delivery', async ({ page }, info) => {
  await page.goto('/es/contactenos');
  await page.getByLabel('Nombre', {exact:true}).fill('Viajero de prueba CI');
  await page.getByLabel('Correo electrónico', {exact:true}).fill('contact-fixture@peruwonderstours.test');
  await page.getByLabel('Asunto', {exact:true}).fill('Consulta de prueba aislada');
  await page.getByLabel('Mensaje', {exact:true}).fill('Esta consulta valida el formulario en la base efímera de pruebas.');
  await page.getByRole('checkbox', {name:/Acepto el tratamiento/}).check();
  await measured(info, 'Submit contact fixture', async()=>{await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Recibimos tu mensaje'})).toBeVisible();});
});

test('Complaint form validates, records a fixture sheet and offers print', async ({ page }, info) => {
  await page.addInitScript(()=>{window.print=()=>{document.documentElement.setAttribute('data-print-requested','true');};});
  await page.goto('/es/libro-de-reclamaciones');
  await page.getByRole('button',{name:'Enviar hoja de reclamación',exact:true}).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByLabel('Nombres y apellidos',{exact:true}).fill('Consumidor de prueba CI');
  await page.getByLabel('Número de documento',{exact:true}).fill('12345678');
  await page.getByLabel('Domicilio',{exact:true}).fill('Dirección ficticia para pruebas aisladas');
  await page.getByLabel('Teléfono',{exact:true}).fill('900000001');
  await page.getByLabel('Correo electrónico',{exact:true}).fill('complaint-fixture@peruwonderstours.test');
  await page.getByLabel('Confirma tu correo',{exact:true}).fill('complaint-fixture@peruwonderstours.test');
  await page.getByLabel('Descripción del servicio o producto',{exact:true}).fill('Servicio ficticio para comprobar el formulario');
  await page.getByLabel('Monto reclamado',{exact:true}).fill('0');
  await page.getByLabel('Detalle',{exact:true}).fill('Registro de prueba en base efímera; sin transacciones ni datos de clientes.');
  await page.getByLabel('Pedido',{exact:true}).fill('Verificar el registro y la constancia de esta hoja ficticia.');
  await page.getByRole('checkbox',{name:/^Declaro que los datos/}).check();
  await measured(info,'Submit complaint fixture',async()=>{await page.getByRole('button',{name:'Enviar hoja de reclamación',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Registramos tu hoja de reclamación'})).toBeVisible();});
  await page.getByRole('button',{name:'Imprimir o guardar como PDF',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested','true');
  await page.screenshot({path:info.outputPath('complaint-receipt.png'),fullPage:true});
});

test('Header menus, language switch and cart drawer keep keyboard access', async ({ page }, info) => {
  await page.goto('/es');
  const menu=page.getByRole('button',{name:'Descubre',exact:true});
  await measured(info,'Open header discovery menu',async()=>{await menu.hover();await expect(menu).toHaveAttribute('aria-expanded','true');});
  await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');
  const cart=page.getByRole('button',{name:'Carrito vacío',exact:true});
  await measured(info,'Open cart drawer',async()=>{await cart.click();await expect(page.getByRole('dialog',{name:'Tu carrito',exact:true})).toBeVisible();});
  await page.getByRole('button',{name:'Cerrar carrito',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Tu carrito',exact:true})).toBeHidden();await expect(cart).toBeFocused();
  await measured(info,'Change language',async()=>{
    await page.getByRole('button',{name:/^Idioma:/}).click();
    await page.getByRole('link',{name:'English',exact:true}).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang',/^en(-|$)/);
  });
});

test('Customer access request and invalid access link give clear feedback', async ({ page }, info) => {
  await page.goto('/es/mis-reservas');
  await page.getByRole('link',{name:'Recibir enlace de acceso',exact:true}).click();
  await expect(page).toHaveURL(/\/es\/cuenta\/acceso/);
  await page.getByLabel('Correo electrónico',{exact:true}).fill('access-fixture@peruwonderstours.test');
  await measured(info,'Request customer access link',async()=>{
    await page.getByRole('button',{name:'Enviarme el enlace',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Si ese correo tiene reservas'})).toBeVisible();
  });
  await page.goto('/es/cuenta/acceso?token=invalid-fixture-token-123456');
  await page.getByRole('button',{name:'Ver mis reservas',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Este enlace no es válido'})).toBeVisible();
});

test('Testimonial submission stays pending moderation', async ({ page }, info) => {
  await page.goto('/es/dejar-testimonio');
  await page.getByLabel('Nombre que se mostrará',{exact:true}).fill('Viajero CI');
  await page.locator('input[name="authorCountry"]').fill('PE');
  await page.getByLabel('Correo electrónico (no se publica)',{exact:true}).fill('review-fixture@peruwonderstours.test');
  await page.getByLabel('Tu testimonio',{exact:true}).fill('Esta opinión ficticia valida el registro aislado y su moderación previa.');
  await page.getByRole('checkbox',{name:/^Autorizo publicar mi testimonio/}).check();
  await page.getByRole('checkbox',{name:/^Acepto el tratamiento/}).check();
  await measured(info,'Submit testimonial fixture',async()=>{
    await page.getByRole('button',{name:'Enviar testimonio',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Lo publicaremos después de revisarlo'})).toBeVisible();
  });
});

test('Tour photo gallery supports next, previous, Escape and focus restoration', async ({ page }, info) => {
  await page.goto(tourPath);
  const opener=page.getByRole('button',{name:/^Ampliar foto 1 de /});
  await measured(info,'Open tour photo gallery',async()=>{await opener.click();await expect(page.getByRole('dialog',{name:/^Galería de fotos:/})).toBeVisible();});
  const gallery=page.getByRole('dialog',{name:/^Galería de fotos:/});
  await gallery.getByRole('button',{name:'Foto siguiente',exact:true}).click();
  await expect(gallery.locator('p[aria-live]')).toContainText(/^2 \/ /);
  await gallery.getByRole('button',{name:'Foto anterior',exact:true}).click();
  await expect(gallery.locator('p[aria-live]')).toContainText(/^1 \/ /);
  await page.keyboard.press('Escape');
  await expect(gallery).toBeHidden();await expect(opener).toBeFocused();
});

import { expect, test } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
const api = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
const database = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/disabled');
if (process.env.CI !== 'true' || [origin, api].some(value => !['localhost', '127.0.0.1'].includes(new URL(value).hostname))
  || !['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/pwt_browser_test') {
  throw new Error('Portuguese browser checks require the isolated CI localhost fixture and pwt_browser_test database.');
}
const slug = 'tour-islas-de-los-uros-y-taquile-full-day';

test('Portuguese selector, search and untranslated catalog fallback remain consistent', async ({ page }, info) => {
  await page.goto('/es');
  await page.getByRole('button', { name: /^Idioma:/ }).click();
  await page.getByRole('link', { name: 'Português', exact: true }).click();
  await expect(page).toHaveURL(/\/pt\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { name: 'Viaje pelo Peru com quem conhece o país', exact: true })).toBeVisible();
  const search = page.getByRole('search', { name: 'Buscar passeios', exact: true });
  await search.getByRole('combobox').fill('Puno');
  await page.getByRole('option', { name: /Puno/i }).first().click();
  await search.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/pt\/tours\?/);
  expect(new URL(page.url()).searchParams.get('destino')).toBeTruthy();
  await expect(page.locator('main h1')).toHaveText('Passeios no Peru');

  const response = await page.request.get(`${api}/tours/${slug}?locale=pt&currency=PEN`);
  expect(response.status()).toBe(200);
  const catalog = await response.json();
  expect(catalog.data).toMatchObject({ locale: 'es', fallback: true });
  await page.goto(`/pt/tours/${slug}`);
  const tourHeader = page.locator('main header').filter({ has: page.locator('h1') });
  await expect(tourHeader.getByText('Conteúdo disponível apenas em espanhol no momento.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true })).toBeVisible();
  await info.attach('portuguese-catalog-locale.json', { body: JSON.stringify({ requestedLocale: 'pt', servedLocale: catalog.data.locale, fallback: catalog.data.fallback }), contentType: 'application/json' });

  // A second fixture has actual PT content: Spanish seed enrichment must not
  // override its card title, breadcrumb or itinerary summary without a warning.
  const publishedSlug = 'arequipa-colca-4-dias-ci';
  const publishedTitle = 'Arequipa e Colca — experiência de teste em português';
  const publishedResponse = await page.request.get(`${api}/tours/${publishedSlug}?locale=pt&currency=PEN`);
  expect(publishedResponse.status()).toBe(200);
  const published = await publishedResponse.json();
  expect(published.data).toMatchObject({ locale: 'pt', fallback: false, title: publishedTitle });
  await page.goto('/pt/tours');
  const translatedCard = page.getByRole('link', { name: publishedTitle, exact: true }).first();
  await expect(translatedCard).toBeVisible();
  await translatedCard.click();
  await expect(page).toHaveURL(new RegExp(`/pt/tours/${publishedSlug}$`));
  await expect(page.locator('main h1')).toHaveText(publishedTitle);
  await expect(tourHeader.getByText('Conteúdo disponível apenas em espanhol no momento.', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Arequipa y Colca 04 días / 03 noches');
  await expect(page.locator('main')).not.toContainText('Día 1: Llegada a Arequipa');
  await expect(page.locator('main')).toContainText('Conteúdo sintético para testar a página em português.');
});

test('Portuguese departure selection, cart and checkout retain Brazilian form labels', async ({ page }) => {
  await page.goto(`/pt/tours/${slug}`);
  const booking = page.locator('#reservar-panel');
  const date = booking.locator('button[data-date]:not([aria-disabled="true"])').first();
  await expect(date).toBeVisible();
  await date.click();
  await booking.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
  await expect(booking.getByRole('button', { name: 'Adicionado', exact: true })).toBeVisible();
  await page.goto('/pt/carrinho');
  await expect(page.locator('main h1')).toHaveText('Seu carrinho');
  await page.getByRole('link', { name: 'Continuar com a reserva', exact: true }).first().click();
  await expect(page).toHaveURL(/\/pt\/checkout/);
  await expect(page.getByRole('heading', { name: 'Seus dados', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar para pagamento', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Viajante');
  await page.getByLabel('Sobrenome', { exact: true }).fill('Teste Brasil');
  await page.getByLabel('E-mail', { exact: true }).fill('pt-checkout@peruwonderstours.test');
  await page.getByLabel('Código do país', { exact: true }).selectOption('+55');
  await page.getByLabel('Celular (WhatsApp)', { exact: true }).fill('11999990001');
  await page.getByLabel('País de residência', { exact: true }).selectOption({ label: 'Brasil' });
  await page.getByRole('button', { name: 'Continuar para pagamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pagamento', exact: true })).toBeVisible();
  // Stop before payment: this verifies the translated flow without creating a charge.
});

test('Portuguese contact submission and legal complaint access use translated URLs', async ({ page }) => {
  await page.goto('/pt/contato');
  await expect(page.locator('main h1')).toHaveText('Fale conosco');
  await page.getByLabel('Nome', { exact: true }).fill('Viajante de teste português');
  await page.getByLabel('E-mail', { exact: true }).fill('pt-contact@peruwonderstours.test');
  await page.getByLabel('Assunto', { exact: true }).fill('Consulta de viagem em português');
  await page.getByLabel('Mensagem', { exact: true }).fill('Mensagem fictícia para validar o formulário em português na base de testes isolada.');
  await page.getByRole('checkbox', { name: /^Aceito o tratamento/ }).check();
  await expect(page.getByRole('link', { name: 'Política de proteção de dados pessoais', exact: true })).toHaveAttribute('href', '/pt/politicas/protecao-de-dados-pessoais');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recebemos sua mensagem' })).toBeVisible();
  await page.goto('/pt/livro-de-reclamacoes');
  await expect(page.locator('main h1')).toHaveText('Livro de Reclamações');
  await expect(page.getByRole('button', { name: 'Enviar folha de reclamação', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Consultar minha reclamação', exact: true }).first().click();
  await expect(page).toHaveURL(/\/pt\/livro-de-reclamacoes\/consulta/);
  await expect(page.getByLabel('Código', { exact: true })).toBeVisible();
});

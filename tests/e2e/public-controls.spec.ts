import { test, expect, type Locator } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Public controls checks require disposable CI services.');
}

test('Catalog filters narrow products, removable chips and reset restore the catalog', async ({ page }, info) => {
  const timings: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const started = performance.now();
    await test.step(action, work);
    timings.push({ action, milliseconds: Math.round(performance.now() - started) });
  }
  try {
    await page.goto('/es/tours');
    const main = page.locator('main');
    const filters = page.getByRole('search', { name: 'Filtrar tours', exact: true });
    // Month choices appear after the client initializes its Lima clock. Waiting for this
    // usable control avoids sending changes to server HTML before handlers are attached.
    await expect(filters.getByLabel('Mes de viaje', { exact: true }).locator('option')).toHaveCount(13);
    const cards = main.locator('article');
    const total = await cards.count();
    expect(total).toBeGreaterThan(10);
    await measured('Filter destination', async () => {
      await filters.getByLabel('Destino', { exact: true }).selectOption({ label: 'Puno' });
      await expect.poll(() => new URL(page.url()).searchParams.get('destino')).toBeTruthy();
      await expect.poll(() => cards.count()).toBeLessThan(total);
      expect(await cards.count()).toBeGreaterThan(0);
      await expect(page.getByRole('button', { name: 'Quitar filtro: Destino: Puno', exact: true })).toBeVisible();
    });
    await measured('Remove destination chip', async () => {
      await page.getByRole('button', { name: 'Quitar filtro: Destino: Puno', exact: true }).click();
      await expect(page).toHaveURL(/\/es\/tours\/?$/);
      await expect(cards).toHaveCount(total);
    });
    await measured('Filter one-day tours', async () => {
      await filters.getByText('1 día', { exact: true }).click();
      await expect(page).toHaveURL(/duracion=1/);
      await expect.poll(() => cards.count()).toBeLessThan(total);
      expect(await cards.count()).toBeGreaterThan(0);
      for (const card of await cards.all()) await expect(card).toContainText('1 día');
    });
    await filters.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(cards).toHaveCount(total);
    const category = filters.getByLabel('Tipo de tour', { exact: true });
    const categoryValue = await category.locator('option').nth(1).getAttribute('value');
    expect(categoryValue).toBeTruthy();
    await measured('Filter tour category', async () => {
      await category.selectOption(categoryValue!);
      await expect.poll(() => new URL(page.url()).searchParams.get('categoria')).toBe(categoryValue);
      await expect.poll(() => cards.count()).toBeGreaterThan(0);
      expect(await cards.count()).toBeLessThanOrEqual(total);
      await expect(page.getByRole('list', { name: 'Filtros aplicados', exact: true })).toBeVisible();
    });
    await filters.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(cards).toHaveCount(total);
    await measured('Empty search and recover products', async () => {
      await filters.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('zzfixture-no-destination-zz');
      await filters.getByRole('button', { name: 'Buscar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'No encontramos tours con esos filtros', exact: true })).toBeVisible();
      // The empty state deliberately shows suggested products; do not count those as search results.
      await expect(main.getByRole('status').filter({ hasText: 'No hay tours con estos filtros' })).toBeVisible();
      await filters.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
      await expect(page).toHaveURL(/\/es\/tours\/?$/);
      await expect(cards).toHaveCount(total);
      await expect(filters.getByRole('searchbox', { name: 'Buscar', exact: true })).toHaveValue('');
    });
  } finally {
    await info.attach('catalog-control-timings.json', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
  }
});

test('Tour itinerary and FAQ reveal useful content with mouse and keyboard', async ({ page }) => {
  await page.goto('/es/tours/arequipa-colca-profundo-condores-4d-3n');
  async function panelFor(trigger: Locator) {
    const id = await trigger.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    return page.locator(`[id=${JSON.stringify(id)}]`);
  }
  const itinerary = page.locator('section[aria-labelledby="itinerario"]');
  const firstDay = itinerary.getByRole('button').first();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'true');
  const firstContent = await panelFor(firstDay);
  await expect(firstContent.locator('p').first()).toBeVisible();
  await firstDay.click();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => firstContent.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(1);
  await firstDay.focus();
  await page.keyboard.press('Space');
  await expect(firstContent.locator('p').first()).toBeVisible();
  const secondDay = itinerary.getByRole('button').nth(1);
  await secondDay.click();
  await expect((await panelFor(secondDay)).locator('p').first()).toBeVisible();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'true');

  const faq = page.locator('section[aria-labelledby="preguntas"]');
  const question = faq.getByRole('button').first();
  const answer = await panelFor(question);
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  await question.click();
  await expect(answer.locator('p').first()).toBeVisible();
  await expect(answer.locator('p').first()).not.toHaveText('');
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => answer.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(1);
});

test('Native banner mouse motion, water drawing and reduced-motion preference work', async ({ page }) => {
  await page.goto('/es');
  const controls=page.getByRole('group',{name:'Destinos del banner principal',exact:true});
  await controls.getByRole('button',{name:'Mostrar Lago Titicaca',exact:true}).click();
  const water=page.locator('[data-effect="water"]');
  await expect(water).toHaveAttribute('data-active','true');
  const rect=(await water.boundingBox())!;
  await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.58);
  await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.58);
  await expect.poll(()=>water.locator('canvas').evaluate(canvas=>{
    const context=(canvas as HTMLCanvasElement).getContext('2d')!;
    return context.getImageData(0,0,(canvas as HTMLCanvasElement).width,(canvas as HTMLCanvasElement).height).data.some((value,index)=>index%4===3&&value>0);
  })).toBe(true);
  await expect.poll(()=>water.locator('canvas').locator('..').evaluate(scene=>{
    const photo=scene.firstElementChild as HTMLElement;
    return new DOMMatrixReadOnly(getComputedStyle(photo).transform).m41;
  })).toBeLessThan(-1);
  await controls.getByRole('button',{name:'Mostrar Machu Picchu',exact:true}).click();
  await expect(page.locator('[data-effect="clouds"] i')).toHaveCount(3);
  await controls.getByRole('button',{name:'Mostrar Lago Titicaca',exact:true}).click();
  await expect(water).toHaveAttribute('data-active','true');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(water).toHaveAttribute('data-active','false');
  await expect(controls.getByRole('button',{name:'Pausar animación y carrusel',exact:true})).toHaveCount(0);
});

import { test, expect } from '@playwright/test';
const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Mobile browser checks require disposable CI services.');

test('Mobile navigation, product hierarchy, traveler picker and static resources', async ({ page }, info) => {
  const samples: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) { const start=performance.now(); await test.step(action, work); samples.push({ action, milliseconds: Math.round(performance.now()-start) }); }
  try {
    await measured('Mobile home', async()=>{await page.goto('/es');await expect(page.locator('#hero-title')).toBeVisible();});
    const viewportWidth=page.viewportSize()!.width;
    await info.attach('mobile-overflow.json',{body:JSON.stringify(await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,innerWidth,scrollWidth:document.documentElement.scrollWidth,unclipped:Array.from(document.body.querySelectorAll("*")).filter(element=>{const rect=element.getBoundingClientRect();if(rect.right<=391)return false;for(let parent=element.parentElement;parent&&parent!==document.body;parent=parent.parentElement){if(["hidden","clip","auto","scroll"].includes(getComputedStyle(parent).overflowX))return false;}return true;}).slice(0,30).map(element=>({tag:element.tagName,className:element.className,rect:element.getBoundingClientRect().toJSON()})),fixedElements:Array.from(document.body.querySelectorAll('*')).filter(element=>getComputedStyle(element).position==='fixed').slice(0,20).map(element=>({tag:element.tagName,className:element.className,rect:element.getBoundingClientRect().toJSON()})),visualViewport:{width:window.visualViewport?.width,scale:window.visualViewport?.scale},viewportMeta:document.querySelector('meta[name=viewport]')?.getAttribute('content'),containers:[document.documentElement,document.body,document.querySelector('main'),document.querySelector('[aria-label="Destinos del Perú"]')].filter(Boolean).map(element=>{const style=getComputedStyle(element!);return{tag:element!.tagName,className:element!.className,overflowX:style.overflowX,overflowY:style.overflowY,width:element!.getBoundingClientRect().width,clientWidth:element!.clientWidth,scrollWidth:element!.scrollWidth};}),offenders:Array.from(document.body.querySelectorAll('*')).map(element=>({tag:element.tagName,className:element.className,rect:element.getBoundingClientRect().toJSON()})).filter(element=>element.rect.right>document.documentElement.clientWidth+1 && element.rect.width>0).slice(0,25)}))),contentType:'application/json'});
    expect(await page.locator('header').evaluate(element=>element.getBoundingClientRect().width)).toBeLessThanOrEqual(viewportWidth+1);
    expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth+1);
    const positions=await page.evaluate(()=>['destinos-title','paquetes-title','enlaces-oficiales'].map(id=>document.getElementById(id)!.getBoundingClientRect().top+scrollY));
    expect(positions[0]).toBeLessThan(positions[2]);expect(positions[1]).toBeLessThan(positions[2]);
    await measured('Open and close mobile menu',async()=>{
      await info.attach('mobile-menu-hit-target.json',{body:JSON.stringify(await page.getByRole('button',{name:'Abrir menú',exact:true}).evaluate(button=>{
        const rect=button.getBoundingClientRect(); const style=getComputedStyle(button);
        const parents=[];for(let element:Element|null=button;element&&parents.length<5;element=element.parentElement){const css=getComputedStyle(element);parents.push({tag:element.tagName,className:element.className,pointerEvents:css.pointerEvents,zIndex:css.zIndex,transform:css.transform,rect:element.getBoundingClientRect().toJSON()});}
        return {rect:rect.toJSON(),pointerEvents:style.pointerEvents,parents,hit:document.elementsFromPoint(rect.x+rect.width/2,rect.y+rect.height/2).slice(0,5).map(element=>({tag:element.tagName,className:element.className}))};
      })),contentType:'application/json'});
      await page.getByRole('button',{name:'Abrir menú',exact:true}).tap();
      await expect(page.getByRole('navigation',{name:'Menú del sitio'})).toBeVisible();
      await page.getByRole('button',{name:'Cerrar menú',exact:true}).tap();
      await expect(page.getByRole('navigation',{name:'Menú del sitio'})).toBeHidden();
    });
    const search=page.getByRole('search',{name:'Buscar tours'});
    await search.getByRole('button',{name:/^Viajeros/}).tap();
    const picker=page.getByRole('dialog',{name:'Elegir viajeros'});
    await picker.getByRole('button',{name:'Agregar un adulto',exact:true}).tap();
    await picker.getByRole('button',{name:'Quitar un adulto',exact:true}).tap();
    await picker.getByRole('button',{name:'Listo',exact:true}).tap();
    await expect(picker).toBeHidden();
    const destinations=page.getByRole('list',{name:'Destinos del Perú'});
    await destinations.scrollIntoViewIfNeeded();
    await measured('Move destination rail',async()=>{
      await page.getByRole('button',{name:'Más destinos',exact:true}).tap();
      await expect.poll(()=>destinations.evaluate(element=>Math.abs(element.children[1].getBoundingClientRect().left-element.getBoundingClientRect().left-16))).toBeLessThan(2);
      await page.getByRole('button',{name:'Destinos anteriores',exact:true}).tap();
      await expect.poll(()=>destinations.evaluate(element=>Math.abs(element.children[0].getBoundingClientRect().left-element.getBoundingClientRect().left-16))).toBeLessThan(2);
    });
    const resources=page.getByRole('navigation',{name:'Enlaces oficiales',exact:true});await resources.scrollIntoViewIfNeeded();
    await expect(resources.getByRole('button',{name:'Pausar carrusel',exact:true})).toBeHidden();
    await expect(resources.getByRole('link')).toHaveCount(6);
    expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth+1);
    await page.screenshot({path:info.outputPath('mobile-resources.png'),fullPage:true});
    await page.goto('/es/libro-de-reclamaciones');
    await expect(page.locator('main h1')).toContainText('Libro de Reclamaciones');
    expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth+1);
    await page.screenshot({path:info.outputPath('mobile-complaints.png'),fullPage:true});
    await page.goto('/es/tours/tour-islas-de-los-uros-y-taquile-full-day');
    await measured('Open mobile booking and add tour',async()=>{
      await page.locator('a[href="#reservar"]').tap();
      await expect(page).toHaveURL(/#reservar$/);
      const booking=page.locator('#reservar');
      const date=booking.locator('button[data-date]:not([aria-disabled="true"])').first();
      await date.tap();
      await booking.getByRole('button',{name:'Agregar al carrito',exact:true}).tap();
      await expect(booking.getByRole('button',{name:'Agregado',exact:true})).toBeVisible();
      const notices=page.getByRole('region',{name:'Notificaciones',exact:true});
      expect(await notices.evaluate(element=>element.getBoundingClientRect().width)).toBeLessThanOrEqual(viewportWidth+1);
    });
    await page.goto('/es/carrito');
    await expect(page.getByRole('link',{name:'Continuar con la reserva',exact:true}).first()).toBeVisible();
    expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth+1);
  } finally {await info.attach('mobile-action-timings.json',{body:JSON.stringify(samples,null,2),contentType:'application/json'});}
});

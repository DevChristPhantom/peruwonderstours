import { test, expect } from '@playwright/test';
const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Mobile browser checks require disposable CI services.');

test('Mobile navigation, product hierarchy, traveler picker and static resources', async ({ page }, info) => {
  const samples: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) { const start=performance.now(); await test.step(action, work); samples.push({ action, milliseconds: Math.round(performance.now()-start) }); }
  try {
    await measured('Mobile home', async()=>{await page.goto('/es');await expect(page.locator('#hero-title')).toBeVisible();});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    const positions=await page.evaluate(()=>['destinos-title','paquetes-title','enlaces-oficiales'].map(id=>document.getElementById(id)!.getBoundingClientRect().top+scrollY));
    expect(positions[0]).toBeLessThan(positions[2]);expect(positions[1]).toBeLessThan(positions[2]);
    await measured('Open and close mobile menu',async()=>{
      await info.attach('mobile-menu-hit-target.json',{body:JSON.stringify(await page.getByRole('button',{name:'Abrir menú',exact:true}).evaluate(button=>{
        const rect=button.getBoundingClientRect(); const style=getComputedStyle(button);
        const parents=[];for(let element:Element|null=button;element&&parents.length<5;element=element.parentElement){const css=getComputedStyle(element);parents.push({tag:element.tagName,className:element.className,pointerEvents:css.pointerEvents,zIndex:css.zIndex,transform:css.transform,rect:element.getBoundingClientRect().toJSON()});}
        return {rect:rect.toJSON(),pointerEvents:style.pointerEvents,parents,hit:document.elementsFromPoint(rect.x+rect.width/2,rect.y+rect.height/2).slice(0,5).map(element=>({tag:element.tagName,className:element.className}))};
      })),contentType:'application/json'});
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Menú del sitio'})).toBeVisible();
      await page.getByRole('button',{name:'Cerrar menú',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Menú del sitio'})).toBeHidden();
    });
    const search=page.getByRole('search',{name:'Buscar tours'});
    await search.getByRole('button',{name:/^Viajeros/}).click();
    const picker=page.getByRole('dialog',{name:'Elegir viajeros'});
    await picker.getByRole('button',{name:'Agregar un adulto',exact:true}).click();
    await picker.getByRole('button',{name:'Quitar un adulto',exact:true}).click();
    await picker.getByRole('button',{name:'Listo',exact:true}).click();
    await expect(picker).toBeHidden();
    const destinations=page.getByRole('list',{name:'Destinos del Perú'});
    await destinations.scrollIntoViewIfNeeded();
    await measured('Move destination rail',async()=>{
      await page.getByRole('button',{name:'Más destinos',exact:true}).click();
      await expect.poll(()=>destinations.evaluate(element=>element.scrollLeft)).toBeGreaterThan(10);
      await page.getByRole('button',{name:'Destinos anteriores',exact:true}).click();
      await expect.poll(()=>destinations.evaluate(element=>element.scrollLeft)).toBeLessThan(5);
    });
    const resources=page.getByRole('navigation',{name:'Enlaces oficiales',exact:true});await resources.scrollIntoViewIfNeeded();
    await expect(resources.getByRole('button',{name:'Pausar carrusel',exact:true})).toBeHidden();
    await expect(resources.getByRole('link')).toHaveCount(6);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await page.screenshot({path:info.outputPath('mobile-resources.png'),fullPage:true});
    await page.goto('/es/libro-de-reclamaciones');
    await expect(page.locator('main h1')).toContainText('Libro de Reclamaciones');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await page.screenshot({path:info.outputPath('mobile-complaints.png'),fullPage:true});
  } finally {await info.attach('mobile-action-timings.json',{body:JSON.stringify(samples,null,2),contentType:'application/json'});}
});

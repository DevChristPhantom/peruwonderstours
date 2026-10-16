import { catalogImageSource } from '../catalog/image-source';
import { SITE } from '../site';

/** Branding for owned editorial copy. Never applied to customer names or testimonial quotations. */
export function editorialBrand(text: string): string {
  return text
    .replace(/https?:\/\/(?:(?:www\.)?andeanperutours\.com|turinet\.turismoads\.com)(?::\d+)?(?=[/?#\s<>"')\]]|$)(?:[/?#][^\s<>"')\]]*)?/gi, value => {
      const url = new URL(value);
      if (url.pathname.startsWith('/images/')) return catalogImageSource(value);
      // Imported owned links point to our current site, not the retiring host.
      return `${SITE.url}${url.pathname}${url.search}${url.hash}`;
    })
    .replace(/Andean Peru Tours Travel Agency|Andean Peru Tours|Peru Andean Tours|Peru Wonders Tours/gi, "peruwonderstours")
    .replace(/(?:Más de|More than)\s+30\s+(?:años de experiencia|years of experience)(?: ofreciendo| offering)?:?/gi, "");
}

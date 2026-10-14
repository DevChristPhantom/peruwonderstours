/** Branding for owned editorial copy. Never applied to customer names or testimonial quotations. */
export function editorialBrand(text: string): string {
  return text
    .replace(/Andean Peru Tours Travel Agency|Andean Peru Tours|Peru Andean Tours|Peru Wonders Tours/gi, "peruwonderstours")
    .replace(/(?:Más de|More than)\s+30\s+(?:años de experiencia|years of experience)(?: ofreciendo| offering)?:?/gi, "");
}

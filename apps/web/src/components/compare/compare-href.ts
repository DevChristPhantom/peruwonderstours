import { isTourSlug } from "@/lib/wishlist/share";

export const COMPARE_PARAM = "tours";

/** `/es/comparar?tours=a,b,c`: compartible, sin datos personales. */
export function compareHref(slugs: readonly string[]): string {
  const list = slugs.filter(isTourSlug).slice(0, 3);
  return list.length ? `/es/comparar?${COMPARE_PARAM}=${list.join(",")}` : "/es/comparar";
}

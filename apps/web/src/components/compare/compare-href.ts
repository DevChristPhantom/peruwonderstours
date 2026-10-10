import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { isTourSlug } from "@/lib/wishlist/share";

export const COMPARE_PARAM = "tours";

/** `/es/comparar?tours=a,b,c` (claves de tour): compartible, sin datos personales. */
export function compareHref(slugs: readonly string[], locale: Locale): string {
  const list = slugs.filter(isTourSlug).slice(0, 3);
  return localePath(locale, list.length ? { pathname: "/comparar", query: { [COMPARE_PARAM]: list.join(",") } } : "/comparar");
}

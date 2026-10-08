"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCompareStore } from "@/stores/compare-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { compareHref } from "./compare-href";

/** Sin selección en la URL: usa la del comparador de esta pestaña, si la hay. */
export function CompareFromStore({ hasSelection }: { hasSelection: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (hasSelection) return;
    const apply = () => {
      const items = useCompareStore.getState().items;
      if (items.length) router.replace(compareHref(items.map((i) => i.slug)));
    };
    if (useCompareStore.persist.hasHydrated()) apply();
    return useCompareStore.persist.onFinishHydration(apply);
  }, [hasSelection, router]);
  return null;
}

export function CompareRemoveButton({ slug, title, remaining }: { slug: string; title: string; remaining: string[] }) {
  const router = useRouter();
  const remove = useCompareStore((s) => s.remove);
  const announce = useUiStore((s) => s.announce);
  return (
    <button
      type="button"
      className={buttonClass("ghost", "md")}
      aria-label={`Quitar ${title} de la comparación`}
      onClick={() => {
        remove(slug);
        announce(`Quitaste ${title} de la comparación.`);
        router.replace(compareHref(remaining.filter((s) => s !== slug)), { scroll: false });
      }}
    >
      <X aria-hidden size={16} strokeWidth={1.5} />
      Quitar
    </button>
  );
}

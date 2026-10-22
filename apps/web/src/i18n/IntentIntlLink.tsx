"use client";

import { forwardRef, type ComponentProps } from "react";

import { useIntentPrefetch } from "@/components/ui/IntentLink";
import { BaseLink } from "./navigation-base";

type Props = ComponentProps<typeof BaseLink>;

/** `Link` con rutas traducidas y prefetch por intención (mouse, toque o foco), como `IntentLink`. */
export const Link = forwardRef<HTMLAnchorElement, Props>(function IntentIntlLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...rest }, ref) {
  const intent = useIntentPrefetch<HTMLAnchorElement>(prefetch, { onMouseEnter, onTouchStart, onFocus });
  return <BaseLink ref={ref} {...(rest as Props)} {...intent} />;
});

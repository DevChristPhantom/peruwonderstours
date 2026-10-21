"use client";

import NextLink from "next/link";
import { forwardRef, useState, type ComponentProps, type FocusEvent, type MouseEvent, type TouchEvent } from "react";

type Props = ComponentProps<typeof NextLink>;

/**
 * Prefetch por intención (guía oficial "prefetch only on hover"): no se descargan por adelantado
 * todas las páginas enlazadas que aparecen en pantalla (en la home eran ~800 KB en 22 rutas), sino
 * la que el usuario está por abrir: al pasar el mouse, al tocarla o al enfocarla con teclado.
 * Un `prefetch` explícito (`true`/`false`) se respeta tal cual.
 */
export function useIntentPrefetch<E extends HTMLElement>(
  prefetch: Props["prefetch"],
  handlers: { onMouseEnter?: (e: MouseEvent<E>) => void; onTouchStart?: (e: TouchEvent<E>) => void; onFocus?: (e: FocusEvent<E>) => void },
) {
  const [active, setActive] = useState(false);
  const explicit = prefetch === true || prefetch === false;
  return {
    prefetch: explicit ? prefetch : active ? null : false,
    onMouseEnter: (e: MouseEvent<E>) => {
      setActive(true);
      handlers.onMouseEnter?.(e);
    },
    onTouchStart: (e: TouchEvent<E>) => {
      setActive(true);
      handlers.onTouchStart?.(e);
    },
    onFocus: (e: FocusEvent<E>) => {
      setActive(true);
      handlers.onFocus?.(e);
    },
  };
}

const IntentLink = forwardRef<HTMLAnchorElement, Props>(function IntentLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...rest }, ref) {
  const intent = useIntentPrefetch<HTMLAnchorElement>(prefetch, { onMouseEnter, onTouchStart, onFocus });
  return <NextLink ref={ref} {...rest} {...intent} />;
});

export default IntentLink;

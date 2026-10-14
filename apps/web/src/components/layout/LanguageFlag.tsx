/** Decorative flags; the adjacent language name remains the accessible label. */
export function LanguageFlag({ locale }: { locale: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 16" width={24} height={16} className="shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/25">
      {locale === "es" ? <>
        <path fill="#d91023" d="M0 0h24v16H0z" />
        <path fill="#fff" d="M8 0h8v16H8z" />
      </> : <>
        <path fill="#012169" d="M0 0h24v16H0z" />
        <path stroke="#fff" strokeWidth={5} d="m0 0 24 16M24 0 0 16" />
        <path stroke="#c8102e" strokeWidth={2} d="m0 0 24 16M24 0 0 16" />
        <path fill="#fff" d="M0 5h24v6H0zM9 0h6v16H9z" />
        <path fill="#c8102e" d="M0 6h24v4H0zM10 0h4v16h-4z" />
      </>}
    </svg>
  );
}

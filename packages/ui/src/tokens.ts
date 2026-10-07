/**
 * Peru Wonders Tours — design tokens tipados.
 * Mismos valores que `tokens.css`; fuente de verdad: design-system/peru-wonders-tours/MASTER.md.
 * Úsalos en JS (GSAP, anime.js, canvas, emails, OG images). En componentes prefiere las variables CSS.
 */

type Scale = Readonly<Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>>;

export const palette = {
  titicaca: {
    50: '#EEF5FA', 100: '#D6E6F2', 200: '#ADCBE3', 300: '#7AA8CC', 400: '#4A84B0', 500: '#2A6593',
    600: '#1C4F7A', 700: '#153F63', 800: '#10304D', 900: '#0B2238', 950: '#06141F',
  },
  terracota: {
    50: '#FCF2EE', 100: '#F7DFD5', 200: '#EEBDA9', 300: '#E29576', 400: '#D46F4D', 500: '#C0532F',
    600: '#A34224', 700: '#84351E', 800: '#66291A', 900: '#4A1F15', 950: '#2E130D',
  },
  selva: {
    50: '#EDF7F1', 100: '#D2EBDC', 200: '#A6D6BA', 300: '#6FBA92', 400: '#3E9A6C', 500: '#23794F',
    600: '#1A6140', 700: '#144D33', 800: '#103B28', 900: '#0B2A1D', 950: '#061A12',
  },
  dorado: {
    50: '#FDF8EA', 100: '#FAEDC7', 200: '#F4D98C', 300: '#EDC152', 400: '#E3A92B', 500: '#C98C17',
    600: '#A06C12', 700: '#7A5210', 800: '#573B0D', 900: '#3B280A', 950: '#231805',
  },
  piedra: {
    50: '#F7F5F2', 100: '#EFEBE6', 200: '#E0DAD2', 300: '#C9C0B5', 400: '#A39889', 500: '#7D7365',
    600: '#5F574C', 700: '#48423A', 800: '#312D28', 900: '#1F1C19', 950: '#141210',
  },
} as const satisfies Record<string, Scale>;

export const noche = {
  ink: '#0B1013',
  surface: '#12191E',
  raised: '#1A232A',
  line: '#2A353D',
  lineStrong: '#6B7A86',
} as const;

export const danger = { 50: '#FEF1EF', 300: '#F08A7C', 600: '#B42318', 950: '#2B1210' } as const;

export interface SemanticColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  link: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  accentSoft: string;
  onAccentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  highlight: string;
  onHighlight: string;
  border: string;
  borderStrong: string;
  ring: string;
  overlay: string;
}

export const colors: Readonly<{ light: SemanticColors; dark: SemanticColors }> = {
  light: {
    background: palette.piedra[50],
    surface: '#FFFFFF',
    surfaceMuted: palette.piedra[100],
    foreground: palette.piedra[900],
    foregroundMuted: palette.piedra[600],
    primary: palette.titicaca[700],
    primaryHover: palette.titicaca[800],
    onPrimary: '#FFFFFF',
    link: palette.titicaca[600],
    accent: palette.terracota[600],
    accentHover: palette.terracota[700],
    onAccent: '#FFFFFF',
    accentSoft: palette.terracota[50],
    onAccentSoft: palette.terracota[700],
    success: palette.selva[600],
    successSoft: palette.selva[50],
    warning: palette.dorado[700],
    warningSoft: palette.dorado[50],
    danger: danger[600],
    dangerSoft: danger[50],
    highlight: palette.dorado[400],
    onHighlight: palette.piedra[900],
    border: palette.piedra[200],
    borderStrong: palette.piedra[500],
    ring: palette.titicaca[500],
    overlay: 'rgba(11, 16, 19, 0.56)',
  },
  dark: {
    background: noche.ink,
    surface: noche.surface,
    surfaceMuted: noche.raised,
    foreground: '#F3F0EB',
    foregroundMuted: '#B3ABA0',
    primary: palette.titicaca[300],
    primaryHover: palette.titicaca[200],
    onPrimary: palette.titicaca[950],
    link: palette.titicaca[300],
    accent: palette.terracota[400],
    accentHover: palette.terracota[300],
    onAccent: '#1A0D08',
    accentSoft: palette.terracota[950],
    onAccentSoft: palette.terracota[300],
    success: palette.selva[300],
    successSoft: palette.selva[900],
    warning: palette.dorado[300],
    warningSoft: palette.dorado[950],
    danger: danger[300],
    dangerSoft: danger[950],
    highlight: palette.dorado[300],
    onHighlight: palette.piedra[900],
    border: noche.line,
    borderStrong: noche.lineStrong,
    ring: '#9CC3E0',
    overlay: 'rgba(0, 0, 0, 0.66)',
  },
};

/** Tokens del hero con dropdown morph (docs/design/hero-morph-spec.md). Siempre oscuros. */
export const hero = {
  ink: '#0B1013',
  panel: 'rgba(14, 19, 23, 0.84)',
  line: 'rgba(255, 255, 255, 0.08)',
  hover: 'rgba(255, 255, 255, 0.065)',
  text: '#FFFFFF',
  soft: 'rgba(255, 255, 255, 0.74)',
  muted: 'rgba(255, 255, 255, 0.60)',
  cta: '#FFFFFF',
  ctaHover: '#E9EEF0',
  onCta: '#0B0F12',
} as const;

export const fonts = {
  sans: '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Fraunces", Georgia, "Times New Roman", serif',
  mono: '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

export const fontSizes = {
  display2xl: 'clamp(2.75rem, 1.6rem + 4.2vw, 5rem)',
  displayXl: 'clamp(2.25rem, 1.5rem + 2.8vw, 3.75rem)',
  h1: 'clamp(2rem, 1.5rem + 1.8vw, 3rem)',
  h2: 'clamp(1.625rem, 1.3rem + 1.2vw, 2.25rem)',
  h3: '1.375rem',
  h4: '1.125rem',
  bodyLg: '1.125rem',
  body: '1rem',
  sm: '0.875rem',
  nav: '0.90625rem',
  xs: '0.8125rem',
  label: '0.75rem',
  priceLg: '1.75rem',
} as const;

export const lineHeights = { tight: 1.05, heading: 1.15, snug: 1.42, body: 1.6 } as const;
export const letterSpacings = { display: '-0.02em', label: '0.08em' } as const;

/** Espaciado en px (base 4). */
export const space = {
  0.5: 2, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96, 32: 128,
} as const;

export const layout = {
  sectionY: 'clamp(4rem, 2.5rem + 6vw, 8rem)',
  gutter: 'clamp(16px, 3.4vw, 52px)',
  headerGutter: 'clamp(20px, 3.4vw, 52px)',
  headerHeight: 76,
  container: 1280,
  containerWide: 1440,
  containerNarrow: 720,
  tapTarget: 44,
} as const;

export const breakpoints = { sm: 375, md: 768, nav: 861, lg: 1024, xl: 1440 } as const;

export const radii = { xs: 6, sm: 9, md: 10, lg: 16, xl: 24, pill: 999 } as const;

export const shadows = {
  xs: '0 1px 2px rgba(31, 28, 25, 0.06)',
  sm: '0 1px 3px rgba(31, 28, 25, 0.08), 0 1px 2px rgba(31, 28, 25, 0.04)',
  md: '0 6px 16px -4px rgba(31, 28, 25, 0.12), 0 2px 4px rgba(31, 28, 25, 0.06)',
  lg: '0 18px 40px -12px rgba(31, 28, 25, 0.2), 0 4px 10px rgba(31, 28, 25, 0.06)',
  overlay: '0 30px 70px -25px rgba(0, 0, 0, 0.65), 0 2px 10px rgba(0, 0, 0, 0.2)',
  sticky: '0 -8px 24px -12px rgba(31, 28, 25, 0.18)',
} as const;

export const zIndex = { base: 0, sticky: 10, header: 20, dropdown: 30, drawer: 40, modal: 50, toast: 60 } as const;

export const motion = {
  easing: {
    /** Curva firma (= --ease de la spec). GSAP: CustomEase.create('pwt', '0.22,1,0.36,1'). */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    standard: 'ease',
  },
  /** Puntos de control para GSAP CustomEase y anime.js cubicBezier(). */
  bezier: {
    out: [0.22, 1, 0.36, 1],
    inOut: [0.65, 0, 0.35, 1],
    in: [0.4, 0, 1, 1],
  },
  /** Duraciones en ms. */
  duration: { instant: 100, fast: 160, base: 250, moderate: 360, morph: 500, slow: 900, hero: 2400 },
  stagger: 60,
  delay: { headerLogo: 350, headerNav: 450, headerActions: 550, scrollCue: 900, searchBar: 700 },
  dropdown: { closeDelay: 140, linkCloseDelay: 60, placePadding: 20, edgeInset: 12, slideOffset: 56 },
  blur: { panel: 8, image: 10, backdrop: 22 },
  /** Valores con prefers-reduced-motion: reduce. */
  reduced: { duration: 0.01, stagger: 0, delay: 0, blur: 0 },
} as const satisfies {
  bezier: Record<string, readonly [number, number, number, number]>;
  [key: string]: unknown;
};

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const tokens = {
  palette,
  noche,
  danger,
  colors,
  hero,
  fonts,
  fontSizes,
  lineHeights,
  letterSpacings,
  space,
  layout,
  breakpoints,
  radii,
  shadows,
  zIndex,
  motion,
} as const;

export type Tokens = typeof tokens;
export type ColorMode = keyof typeof colors;

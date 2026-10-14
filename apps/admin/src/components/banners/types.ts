export interface HeroBanner {
  id: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  bytes: number;
  revision: number;
  hasPoster: boolean;
}
export const BANNER_MAX_BYTES = 16 * 1024 * 1024;

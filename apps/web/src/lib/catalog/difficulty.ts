/** Códigos de dificultad que envía la API; se traducen con `common.difficultyLevels`. */
export const DIFFICULTY_LEVELS = ["easy", "moderate", "challenging", "extreme"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export function isDifficultyLevel(value: string | null | undefined): value is DifficultyLevel {
  return (DIFFICULTY_LEVELS as readonly string[]).includes(value ?? "");
}

export const JOURNAL_TOPICS = ["historias", "leyendas", "guias"] as const;
export type JournalTopic = (typeof JOURNAL_TOPICS)[number];

/** Stable CMS tags work regardless of the language of the article. */
export function journalTopic(tags: readonly string[]): JournalTopic {
  const normalized = tags.map(tag => tag.trim().toLowerCase());
  if (normalized.includes("historias")) return "historias";
  if (normalized.includes("leyendas")) return "leyendas";
  return "guias";
}

export function isJournalTopic(value: unknown): value is JournalTopic {
  return typeof value === "string" && JOURNAL_TOPICS.includes(value as JournalTopic);
}

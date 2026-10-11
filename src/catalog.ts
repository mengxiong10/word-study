import raw from './content/catalog.json';
import authored from './content/authored.json';
import explanations from './content/original-explanations.json';
import contentNotes from './content/content-notes.json';
import contrastsRaw from './content/contrasts.json';
import type { Catalog, Contrast, Explanation, Group, Question } from './model';
const noteMap = new Map(
  (contentNotes as { questionId: string; message: string }[]).map((n) => [n.questionId, n.message]),
);
const originalExplanations = explanations as Record<string, Explanation>;
export const catalog: Catalog = {
  groups: raw.groups as Group[],
  questions: [
    ...raw.questions.map((q) => ({
      ...q,
      explanation: originalExplanations[q.id],
      ...(noteMap.has(q.id) ? { assessmentExcluded: true, editorialNote: noteMap.get(q.id) } : {}),
    })),
    ...authored,
  ] as Question[],
};
export const contrasts = contrastsRaw as Record<string, Contrast>;
export const groupMap = new Map(catalog.groups.map((g) => [g.id, g]));
export const questionMap = new Map(catalog.questions.map((q) => [q.id, q]));

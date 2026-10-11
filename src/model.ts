export type Category = 'idiom' | 'word';
export type Explanation = { clue: string; correctReason: string; optionReasons: string[] };
export type Group = {
  id: string;
  category: Category;
  number: number;
  title: string;
  studyText: string;
  source: { book: string; page: number; printedPage?: number };
  terms?: {
    word: string;
    definition: string;
    examples: string[];
    source: { book: string; page: number };
  }[];
  wordCount?: number;
};
export type Question = {
  assessmentExcluded?: boolean;
  editorialNote?: string;
  id: string;
  kind: 'original' | 'authored';
  category: Category;
  groupIds: string[];
  stem: string;
  options: string[];
  answerIndex: number;
  source?: { book: string; page: number; number: number };
  explanation: Explanation;
};
export type Catalog = { groups: Group[]; questions: Question[] };
export type Attempt = {
  id: string;
  questionId: string;
  selected: number;
  correct: boolean;
  confident: boolean;
  at: string;
  mode: Task['mode'];
};
export type Progress = { learned: boolean; stage: number; due: string; lastReviewed: string };
export type Task = {
  id: string;
  mode: 'daily' | 'group' | 'review' | 'selftest';
  groupId?: string;
  questionIds: string[];
  reviewCount: number;
  index: number;
  phase: 'study' | 'quiz' | 'results';
  choices: Record<string, number>;
  revealed: string[];
  committed: string[];
};
export type State = {
  schemaVersion: 1;
  attempts: Attempt[];
  progress: Record<string, Progress>;
  task: Task | null;
  nextCategory: Category;
};
export type Contrast = { summary: string; distinctions: { term: string; note: string }[] };

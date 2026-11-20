import type { Difficulty } from "@/types/submission.types";

export interface SolutionManifestEntry {
  problemId: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  language: string;
  languageName: string;
  path: string;
  submittedAt?: string;
}

export interface SolutionManifest {
  version: 1;
  solutions: SolutionManifestEntry[];
}

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface SubmissionTopic {
  name: string;
  slug: string;
}

export interface Submission {
  submissionId: string;

  problemId: string;
  frontendId?: string;

  title: string;
  slug: string;

  difficulty: Difficulty;

  language: string;
  languageName: string;

  code: string;

  runtime?: string;
  memory?: string;

  topics: SubmissionTopic[];

  url: string;
  submittedAt: string;

  status: "Accepted";
}

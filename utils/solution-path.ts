import type { Submission } from "@/types/submission.types";

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  bash: "sh",
  c: "c",
  "c++": "cpp",
  csharp: "cs",
  golang: "go",
  java: "java",
  javascript: "js",
  kotlin: "kt",
  mysql: "sql",
  oracle: "sql",
  php: "php",
  python: "py",
  python3: "py",
  ruby: "rb",
  rust: "rs",
  scala: "scala",
  swift: "swift",
  typescript: "ts",
};

function getExtension(language: string): string {
  const normalized = language.trim().toLowerCase();

  return LANGUAGE_EXTENSIONS[normalized] ?? "txt";
}

export function getSolutionPath(submission: Submission): string {
  const problemNumber = submission.frontendId
    ? submission.frontendId.padStart(4, "0")
    : submission.problemId.padStart(4, "0");

  const slug = submission.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const extension = getExtension(submission.language);

  return [
    submission.difficulty,
    `${problemNumber}-${slug}`,
    `solution.${extension}`,
  ].join("/");
}

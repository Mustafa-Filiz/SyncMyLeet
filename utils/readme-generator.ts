import type { Submission } from "../types/submission.types";
import { getSolutionPath } from "../utils/solution-path";

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function escapeLinkText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\r?\n/g, " ");
}

function createProgressBar(count: number, total: number): string {
  if (total === 0) return "—";

  const percentage = Math.round((count / total) * 100);
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;

  return `${"█".repeat(filled)}${"░".repeat(empty)} ${percentage}%`;
}

export function generateReadme(submissions: Submission[]): string {
  // Keep only the newest submission for each solution path.
  const uniqueSolutions = new Map<string, Submission>();

  for (const submission of submissions) {
    const path = getSolutionPath(submission);

    if (!uniqueSolutions.has(path)) {
      uniqueSolutions.set(path, submission);
    }
  }

  const solutions = [...uniqueSolutions.entries()].sort(([pathA], [pathB]) =>
    pathA.localeCompare(pathB),
  );

  const totalSolutions = solutions.length;

  const difficultyCounts = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  const languageCounts = new Map<string, number>();

  for (const [, submission] of solutions) {
    difficultyCounts[submission.difficulty] += 1;

    languageCounts.set(
      submission.languageName,
      (languageCounts.get(submission.languageName) ?? 0) + 1,
    );
  }

  const latestSubmissionDate = solutions
    .map(([, submission]) => submission.submittedAt)
    .sort((a, b) => b.localeCompare(a))[0];

  const languageTable = [...languageCounts.entries()]
    .sort(([nameA, countA], [nameB, countB]) => {
      return countB - countA || nameA.localeCompare(nameB);
    })
    .map(([name, count]) => {
      return `| ${escapeTable(name)} | ${count} | ${createProgressBar(count, totalSolutions)} |`;
    });

  const difficultyTable = (
    Object.entries(difficultyCounts) as [
      keyof typeof difficultyCounts,
      number,
    ][]
  ).map(([difficulty, count]) => {
    return `| ${difficulty} | ${count} | ${createProgressBar(count, totalSolutions)} |`;
  });

  const solutionTable = solutions.map(([path, submission]) => {
    const link = `./${encodeURI(path)}`;
    const title = escapeLinkText(submission.title);

    return [
      `| [${title}](${link})`,
      `| ${submission.difficulty}`,
      `| ${escapeTable(submission.languageName)} |`,
    ].join(" ");
  });

  return [
    "# LeetCode Solutions",
    "",
    "A collection of accepted LeetCode solutions synchronized with GitHub using **Sync My Leet**.",
    "",
    "## Overview",
    "",
    "| Total Solutions | Languages | Last Updated |",
    "|:---:|:---:|:---:|",
    `| **${totalSolutions}** | **${languageCounts.size}** | **${latestSubmissionDate ? latestSubmissionDate.slice(0, 10) : "—"}** |`,
    "",
    "## Difficulty Distribution",
    "",
    "| Difficulty | Solutions | Distribution |",
    "|:---|---:|:---|",
    ...difficultyTable,
    "",
    "## Language Distribution",
    "",
    "| Language | Solutions | Distribution |",
    "|:---|---:|:---|",
    ...languageTable,
    "",
    "## Solutions",
    "",
    "| Problem | Difficulty | Language |",
    "|:---|:---:|:---|",
    ...solutionTable,
    "",
    "---",
    "",
    '<p align="center">',
    '  Generated automatically by <a href="https://github.com/Mustafa-Filiz/SyncMyLeet">Sync My Leet</a>.',
    "</p>",
    "",
    '<p align="center">',
    "  Statistics are based on the submissions currently stored by the extension (up to 200).",
    "</p>",
    "",
  ].join("\n");
}

import type {
  SolutionManifestEntry,
  SolutionManifest,
} from "@/types/manifest.types";

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

export function generateReadme(manifest: SolutionManifest): string {
  const solutions = [...manifest.solutions].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const totalSolutions = solutions.length;

  const difficultyCounts = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  const languageCounts = new Map<string, number>();

  for (const solution of solutions) {
    difficultyCounts[solution.difficulty] += 1;

    languageCounts.set(
      solution.languageName,
      (languageCounts.get(solution.languageName) ?? 0) + 1,
    );
  }

  const latestSubmissionDate = solutions
    .map((solution) => solution.submittedAt)
    .filter((date): date is string => Boolean(date))
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

  const solutionTable = solutions.map((solution: SolutionManifestEntry) => {
    const link = `./${encodeURI(solution.path)}`;
    const title = escapeLinkText(solution.title);

    return [
      `| [${title}](${link})`,
      `| ${solution.difficulty}`,
      `| ${escapeTable(solution.languageName)} |`,
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
    "  Statistics are based on solution files currently present in this repository.",
    "</p>",
    "",
  ].join("\n");
}

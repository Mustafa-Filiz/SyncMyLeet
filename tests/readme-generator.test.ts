import { describe, expect, it } from "vitest";
import { generateReadme } from "@/utils/readme-generator";
import type {
  SolutionManifest,
  SolutionManifestEntry,
} from "@/types/manifest.types";

const createSolution = (
  overrides: Partial<SolutionManifestEntry> = {},
): SolutionManifestEntry => ({
  problemId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  language: "typescript",
  languageName: "TypeScript",
  path: "Easy/0001-two-sum/solution.ts",
  submittedAt: "2026-11-18T10:00:00.000Z",
  ...overrides,
});

const createManifest = (
  solutions: SolutionManifestEntry[] = [],
): SolutionManifest => ({
  version: 1,
  solutions,
});

describe("generateReadme", () => {
  it("generates README for an empty manifest", () => {
    const result = generateReadme(createManifest());

    expect(result).toContain("# LeetCode Solutions");
    expect(result).toContain("| **0** | **0** | **—** |");
    expect(result).toContain("## Difficulty Distribution");
    expect(result).toContain("## Language Distribution");
    expect(result).toContain("## Solutions");
  });

  it("includes problem information and solution path", () => {
    const result = generateReadme(createManifest([createSolution()]));

    expect(result).toContain("Two Sum");
    expect(result).toContain("Easy");
    expect(result).toContain("TypeScript");
    expect(result).toContain("0001-two-sum/solution.ts");
  });

  it("counts unique solution entries", () => {
    const result = generateReadme(
      createManifest([
        createSolution(),
        createSolution({
          submittedAt: "2026-11-18T11:00:00.000Z",
        }),
      ]),
    );

    expect(result).toContain("| **2** | **1** | **2026-11-18** |");
    expect(result.match(/\| \[Two Sum\]/g)).toHaveLength(2);
  });

  it("counts different languages separately", () => {
    const result = generateReadme(
      createManifest([
        createSolution(),
        createSolution({
          language: "python3",
          languageName: "Python3",
        }),
      ]),
    );

    expect(result).toContain("| **2** | **2** |");
    expect(result).toContain("| TypeScript | 1 |");
    expect(result).toContain("| Python3 | 1 |");
  });

  it("sorts languages by solution count in descending order", () => {
    const result = generateReadme(
      createManifest([
        createSolution({
          language: "javascript",
          languageName: "JavaScript",
        }),
        createSolution({
          language: "typescript",
          languageName: "TypeScript",
        }),
        createSolution({
          problemId: "2",
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          path: "Easy/0002-add-two-numbers/solution.ts",
          language: "typescript",
          languageName: "TypeScript",
        }),
      ]),
    );

    const typescriptIndex = result.indexOf("| TypeScript | 2 |");
    const javascriptIndex = result.indexOf("| JavaScript | 1 |");

    expect(typescriptIndex).toBeGreaterThan(-1);
    expect(javascriptIndex).toBeGreaterThan(-1);
    expect(typescriptIndex).toBeLessThan(javascriptIndex);
  });

  it("calculates difficulty distribution correctly", () => {
    const result = generateReadme(
      createManifest([
        createSolution(),
        createSolution({
          problemId: "2",
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          difficulty: "Medium",
          path: "Medium/0002-add-two-numbers/solution.ts",
        }),
        createSolution({
          problemId: "3",
          title: "Median of Two Sorted Arrays",
          slug: "median-of-two-sorted-arrays",
          difficulty: "Hard",
          path: "Hard/0003-median-of-two-sorted-arrays/solution.ts",
        }),
        createSolution({
          problemId: "4",
          title: "Longest Substring",
          slug: "longest-substring",
          difficulty: "Medium",
          path: "Medium/0004-longest-substring/solution.ts",
        }),
      ]),
    );

    expect(result).toContain("| Easy | 1 |");
    expect(result).toContain("| Medium | 2 |");
    expect(result).toContain("| Hard | 1 |");
    expect(result).toContain("50%");
    expect(result).toContain("25%");
  });

  it("uses the latest available submission date", () => {
    const result = generateReadme(
      createManifest([
        createSolution({
          submittedAt: "2026-11-15T10:00:00.000Z",
        }),
        createSolution({
          problemId: "2",
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          path: "Easy/0002-add-two-numbers/solution.ts",
          submittedAt: "2026-11-20T12:00:00.000Z",
        }),
      ]),
    );

    expect(result).toContain("| **2** | **1** | **2026-11-20** |");
  });

  it("ignores solutions without submission dates", () => {
    const result = generateReadme(
      createManifest([
        createSolution({
          submittedAt: undefined,
        }),
        createSolution({
          problemId: "2",
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          path: "Easy/0002-add-two-numbers/solution.ts",
          submittedAt: "2026-11-20T12:00:00.000Z",
        }),
      ]),
    );

    expect(result).toContain("| **2** | **1** | **2026-11-20** |");
  });

  it("shows no date when all submission dates are unknown", () => {
    const result = generateReadme(
      createManifest([
        createSolution({
          submittedAt: undefined,
        }),
      ]),
    );

    expect(result).toContain("| **1** | **1** | **—** |");
  });

  it("escapes special characters in problem titles", () => {
    const result = generateReadme(
      createManifest([
        createSolution({
          title: "Problem | [Example]",
        }),
      ]),
    );

    expect(result).toContain("Problem \\| \\[Example\\]");
  });

  it("handles an empty language distribution", () => {
    const result = generateReadme(createManifest());

    expect(result).not.toContain("NaN%");
  });

  it("uses repository-based statistics in the footer", () => {
    const result = generateReadme(createManifest());

    expect(result).toContain(
      "Statistics are based on solution files currently present in this repository.",
    );
    expect(result).not.toContain("up to 200");
  });
});

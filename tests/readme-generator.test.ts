import { describe, expect, it } from "vitest";
import { generateReadme } from "@/utils/readme-generator";
import type { Submission } from "@/types/submission.types";

const createSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  submissionId: "123",
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  language: "typescript",
  languageName: "TypeScript",
  code: "console.log('hello')",
  topics: [],
  url: "https://leetcode.com/problems/two-sum/",
  submittedAt: "2026-11-18T10:00:00.000Z",
  status: "Accepted",
  ...overrides,
});

describe("generateReadme", () => {
  it("generates README for an empty history", () => {
    const result = generateReadme([]);

    expect(result).toContain("# LeetCode Solutions");
    expect(result).toContain("| **0** | **0** | **—** |");
    expect(result).toContain("## Difficulty Distribution");
    expect(result).toContain("## Language Distribution");
    expect(result).toContain("## Solutions");
  });

  it("includes problem information and solution path", () => {
    const result = generateReadme([createSubmission()]);

    expect(result).toContain("Two Sum");
    expect(result).toContain("Easy");
    expect(result).toContain("TypeScript");
    expect(result).toContain("0001-two-sum/solution.ts");
  });

  it("counts unique solution paths instead of submissions", () => {
    const first = createSubmission();

    const second = createSubmission({
      submissionId: "456",
      code: "console.log('updated')",
      submittedAt: "2026-11-18T11:00:00.000Z",
    });

    const result = generateReadme([second, first]);

    expect(result).toContain("| **1** | **1** | **2026-11-18** |");
    expect(result.match(/\| \[Two Sum\]/g)).toHaveLength(1);
  });

  it("counts different languages separately", () => {
    const typescript = createSubmission();

    const python = createSubmission({
      submissionId: "456",
      language: "python3",
      languageName: "Python3",
    });

    const result = generateReadme([typescript, python]);

    expect(result).toContain("| **2** | **2** |");
    expect(result).toContain("| TypeScript | 1 |");
    expect(result).toContain("| Python3 | 1 |");
  });

  it("sorts languages by solution count in descending order", () => {
    const submissions = [
      createSubmission({
        languageName: "JavaScript",
        language: "javascript",
      }),
      createSubmission({
        submissionId: "456",
        languageName: "TypeScript",
        language: "typescript",
      }),
      createSubmission({
        submissionId: "789",
        languageName: "TypeScript",
        language: "typescript",
        problemId: "2",
        frontendId: "2",
        title: "Add Two Numbers",
        slug: "add-two-numbers",
      }),
    ];

    const result = generateReadme(submissions);

    const typescriptIndex = result.indexOf("| TypeScript | 2 |");
    const javascriptIndex = result.indexOf("| JavaScript | 1 |");

    expect(typescriptIndex).toBeGreaterThan(-1);
    expect(javascriptIndex).toBeGreaterThan(-1);
    expect(typescriptIndex).toBeLessThan(javascriptIndex);
  });

  it("calculates difficulty distribution correctly", () => {
    const submissions = [
      createSubmission(),
      createSubmission({
        submissionId: "456",
        difficulty: "Medium",
        problemId: "2",
        frontendId: "2",
        title: "Add Two Numbers",
        slug: "add-two-numbers",
      }),
      createSubmission({
        submissionId: "789",
        difficulty: "Hard",
        problemId: "3",
        frontendId: "3",
        title: "Median of Two Sorted Arrays",
        slug: "median-of-two-sorted-arrays",
      }),
      createSubmission({
        submissionId: "101",
        difficulty: "Medium",
        problemId: "4",
        frontendId: "4",
        title: "Longest Substring",
        slug: "longest-substring",
      }),
    ];

    const result = generateReadme(submissions);

    expect(result).toContain("| Easy | 1 |");
    expect(result).toContain("| Medium | 2 |");
    expect(result).toContain("| Hard | 1 |");
    expect(result).toContain("50%");
    expect(result).toContain("25%");
  });

  it("uses the latest submission date", () => {
    const submissions = [
      createSubmission({
        submittedAt: "2026-11-15T10:00:00.000Z",
      }),
      createSubmission({
        submissionId: "456",
        problemId: "2",
        frontendId: "2",
        title: "Add Two Numbers",
        slug: "add-two-numbers",
        submittedAt: "2026-11-20T12:00:00.000Z",
      }),
    ];

    const result = generateReadme(submissions);

    expect(result).toContain("| **2** | **1** | **2026-11-20** |");
  });

  it("escapes special characters in problem titles", () => {
    const submission = createSubmission({
      title: "Problem | [Example]",
    });

    const result = generateReadme([submission]);

    expect(result).toContain("Problem \\| \\[Example\\]");
  });

  it("handles an empty language distribution", () => {
    const result = generateReadme([]);

    expect(result).not.toContain("NaN%");
  });
});

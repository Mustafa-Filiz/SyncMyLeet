import { describe, expect, it } from "vitest";
import { generateReadme } from "../utils/readme-generator";
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
    expect(result).toContain("**Total solutions:** 0");
  });

  it("includes problem information", () => {
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

    expect(result).toContain("**Total solutions:** 1");
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

    expect(result).toContain("**Total solutions:** 2");
    expect(result).toContain("| TypeScript | 1 |");
    expect(result).toContain("| Python3 | 1 |");
  });

  it("escapes pipe characters in problem titles", () => {
    const submission = createSubmission({
      title: "Problem | Example",
    });

    const result = generateReadme([submission]);

    expect(result).toContain("Problem \\| Example");
  });
});

import { SubmissionSchema } from "../schemas/submission.schema";
import { describe, expect, it } from "vitest";

const validSubmission = {
  submissionId: "123456789",

  problemId: "1",
  frontendId: "1",

  title: "Two Sum",
  slug: "two-sum",

  difficulty: "Easy",

  language: "typescript",
  languageName: "TypeScript",

  code: "function twoSum() {}",

  runtime: "52 ms",
  memory: "45.2 MB",

  topics: [
    {
      name: "Array",
      slug: "array",
    },
  ],

  url: "https://leetcode.com/problems/two-sum/submissions/123456789/",

  submittedAt: "2026-11-18T00:00:00.000Z",

  status: "Accepted",
};

describe("SubmissionSchema", () => {
  it("should validate a valid submission", () => {
    const result = SubmissionSchema.safeParse(validSubmission);

    expect(result.success).toBe(true);
  });

  it("should reject an invalid difficulty", () => {
    const result = SubmissionSchema.safeParse({
      ...validSubmission,
      difficulty: "Unknown",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an empty source code", () => {
    const result = SubmissionSchema.safeParse({
      ...validSubmission,
      code: "",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an invalid submission ID", () => {
    const result = SubmissionSchema.safeParse({
      ...validSubmission,
      submissionId: "",
    });

    expect(result.success).toBe(false);
  });
});

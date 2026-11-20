import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertFile } from "@/services/github.service";
import { getSettings } from "@/storage/settings.storage";
import { getSyncRecord, saveSyncRecord } from "@/storage/sync.storage";
import { getSubmissionHistory } from "@/storage/submission.storage";
import {
  getLastGeneratedReadme,
  saveGeneratedReadme,
} from "@/storage/readme.storage";
import { performSyncSubmission, syncSubmission } from "@/services/sync.service";
import type { Submission } from "@/types/submission.types";

vi.mock("@/services/github.service", () => ({
  upsertFile: vi.fn(),
}));

vi.mock("@/storage/settings.storage", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/storage/sync.storage", () => ({
  getSyncRecord: vi.fn(),
  saveSyncRecord: vi.fn(),
}));

vi.mock("@/storage/submission.storage", () => ({
  getSubmissionHistory: vi.fn(),
}));

vi.mock("@/storage/readme.storage", () => ({
  getLastGeneratedReadme: vi.fn(),
  saveGeneratedReadme: vi.fn(),
}));

vi.mock("@/utils/readme-generator", () => ({
  generateReadme: vi.fn(() => "# LeetCode Solutions"),
}));

const settings = {
  token: "github_pat_test",
  owner: "test-user",
  repo: "leetcode-solutions",
  syncMode: "both" as const,
};

function createSubmission(submissionId: string): Submission {
  return {
    submissionId,
    problemId: "1234",
    title: `Two Sum ${submissionId}`,
    slug: `two-sum-${submissionId}`,
    difficulty: "Easy",
    language: "typescript",
    languageName: "TypeScript",
    code: "console.log('Hello World');",
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
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("sync.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSettings).mockResolvedValue(settings);
    vi.mocked(getSyncRecord).mockResolvedValue(undefined);
    vi.mocked(saveSyncRecord).mockResolvedValue(undefined);
    vi.mocked(upsertFile).mockResolvedValue({} as never);
    vi.mocked(getSubmissionHistory).mockResolvedValue([]);
    vi.mocked(getLastGeneratedReadme).mockResolvedValue("# LeetCode Solutions");
    vi.mocked(saveGeneratedReadme).mockResolvedValue(undefined);
  });

  describe("performSyncSubmission", () => {
    it("should return already synced when submission was previously synced", async () => {
      vi.mocked(getSyncRecord).mockResolvedValue({
        submissionId: "123",
        filePath: "Easy/1-two-sum/solution.ts",
        status: "synced",
        updatedAt: new Date().toISOString(),
      });

      const result = await performSyncSubmission(
        createSubmission("123"),
        "manual",
      );

      expect(result).toMatchObject({
        success: true,
        status: "synced",
        message: "This submission has already been synced.",
      });

      expect(upsertFile).not.toHaveBeenCalled();
    });
  });

  describe("syncSubmission concurrency", () => {
    it("should share the same promise for concurrent requests of the same submission", async () => {
      const gate = deferred<unknown>();

      vi.mocked(upsertFile).mockImplementation(
        () => gate.promise as Promise<never>,
      );

      const submission = createSubmission("123");

      const first = syncSubmission(submission, "manual");
      const second = syncSubmission(submission, "manual");

      expect(first).toBe(second);

      await vi.waitFor(() => {
        expect(upsertFile).toHaveBeenCalledTimes(1);
      });

      gate.resolve({});

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toEqual(secondResult);
      expect(upsertFile).toHaveBeenCalledTimes(1);
    });

    it("should process different submissions sequentially", async () => {
      const gate = deferred<unknown>();

      vi.mocked(upsertFile).mockImplementation(
        () => gate.promise as Promise<never>,
      );

      const first = syncSubmission(createSubmission("123"), "manual");
      const second = syncSubmission(createSubmission("456"), "manual");

      await vi.waitFor(() => {
        expect(upsertFile).toHaveBeenCalledTimes(1);
      });

      gate.resolve({});

      await Promise.all([first, second]);

      expect(upsertFile).toHaveBeenCalledTimes(2);
    });

    it("should continue the queue after a failed operation", async () => {
      vi.mocked(upsertFile)
        .mockRejectedValueOnce(new Error("GitHub unavailable"))
        .mockResolvedValue({} as never);

      const first = syncSubmission(createSubmission("123"), "manual");
      const second = syncSubmission(createSubmission("456"), "manual");

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult.success).toBe(false);
      expect(secondResult.success).toBe(true);
    });

    it("should allow retry after the previous operation completes", async () => {
      const submission = createSubmission("123");

      await syncSubmission(submission, "manual");

      vi.mocked(getSyncRecord).mockResolvedValue(undefined);

      await syncSubmission(submission, "manual");

      expect(upsertFile).toHaveBeenCalledTimes(2);
    });
  });
});

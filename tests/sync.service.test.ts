import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFile, upsertFile } from "@/services/github.service";
import { synchronizeSolutionManifest } from "@/services/solution-manifest.service";
import { getSettings } from "@/storage/settings.storage";
import { getSyncRecord, saveSyncRecord } from "@/storage/sync.storage";
import { performSyncSubmission, syncSubmission } from "@/services/sync.service";
import { generateReadme } from "@/utils/readme-generator";
import type { Submission } from "@/types/submission.types";
import type { SolutionManifest } from "@/types/manifest.types";

vi.mock("@/services/github.service", () => ({
  getFile: vi.fn(),
  upsertFile: vi.fn(),
}));

vi.mock("@/services/solution-manifest.service", () => ({
  synchronizeSolutionManifest: vi.fn(),
}));

vi.mock("@/storage/settings.storage", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/storage/sync.storage", () => ({
  getSyncRecord: vi.fn(),
  saveSyncRecord: vi.fn(),
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

const manifest: SolutionManifest = {
  version: 1,
  solutions: [],
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
    vi.mocked(getFile).mockResolvedValue("# LeetCode Solutions");

    vi.mocked(synchronizeSolutionManifest).mockResolvedValue(manifest);
    vi.mocked(generateReadme).mockReturnValue("# LeetCode Solutions");
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
      expect(synchronizeSolutionManifest).not.toHaveBeenCalled();
    });

    it("should synchronize the manifest with the new submission", async () => {
      const submission = createSubmission("123");

      const result = await performSyncSubmission(submission, "manual");

      expect(result.success).toBe(true);

      expect(synchronizeSolutionManifest).toHaveBeenCalledWith(
        {
          token: settings.token,
          owner: settings.owner,
          repo: settings.repo,
        },
        submission,
      );

      expect(generateReadme).toHaveBeenCalledWith(manifest);
    });

    it("should not update README when its content has not changed", async () => {
      const result = await performSyncSubmission(
        createSubmission("123"),
        "manual",
      );

      expect(result.success).toBe(true);

      // Only the solution file should be uploaded.
      expect(upsertFile).toHaveBeenCalledTimes(1);
      expect(upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "Easy/1234-two-sum-123/solution.ts",
        }),
      );
    });

    it("should update README when its content has changed", async () => {
      vi.mocked(getFile).mockResolvedValue("# Old README");

      const result = await performSyncSubmission(
        createSubmission("123"),
        "manual",
      );

      expect(result.success).toBe(true);

      expect(upsertFile).toHaveBeenCalledTimes(2);

      expect(upsertFile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: "README.md",
          content: "# LeetCode Solutions",
          message: "docs: update LeetCode solutions README",
        }),
      );
    });

    it("should mark sync as failed when manifest synchronization fails", async () => {
      vi.mocked(synchronizeSolutionManifest).mockRejectedValue(
        new Error("Manifest synchronization failed"),
      );

      const result = await performSyncSubmission(
        createSubmission("123"),
        "manual",
      );

      expect(result).toMatchObject({
        success: false,
        status: "failed",
        message: "Manifest synchronization failed",
      });

      expect(saveSyncRecord).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "failed",
          error: "Manifest synchronization failed",
        }),
      );
    });

    it("should mark sync as failed when README retrieval fails", async () => {
      vi.mocked(getFile).mockRejectedValue(new Error("GitHub unavailable"));

      const result = await performSyncSubmission(
        createSubmission("123"),
        "manual",
      );

      expect(result).toMatchObject({
        success: false,
        status: "failed",
        message: "GitHub unavailable",
      });
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

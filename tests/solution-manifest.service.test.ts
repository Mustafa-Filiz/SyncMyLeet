import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getFile,
  getRepositoryTree,
  upsertFile,
} from "@/services/github.service";
import { synchronizeSolutionManifest } from "@/services/solution-manifest.service";
import type { GitHubTreeItem } from "@/services/github.service";
import type {
  SolutionManifest,
  SolutionManifestEntry,
} from "@/types/manifest.types";
import type { Submission } from "@/types/submission.types";

vi.mock("@/services/github.service", () => ({
  getFile: vi.fn(),
  getRepositoryTree: vi.fn(),
  upsertFile: vi.fn(),
}));

const credentials = {
  token: "github-token",
  owner: "test-owner",
  repo: "test-repo",
};

const createTreeItem = (path: string): GitHubTreeItem => ({
  path,
  mode: "100644",
  type: "blob",
  sha: "test-sha",
});

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

const createDiscoveredSolution = (
  overrides: Partial<SolutionManifestEntry> = {},
): SolutionManifestEntry => ({
  problemId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  language: "typescript",
  languageName: "TypeScript",
  path: "Easy/0001-two-sum/solution.ts",
  ...overrides,
});

const createManifest = (
  solutions: SolutionManifestEntry[] = [],
): SolutionManifest => ({
  version: 1,
  solutions,
});

const createSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  submissionId: "submission-1",
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  language: "typescript",
  languageName: "TypeScript",
  code: "function twoSum() {}",
  topics: [],
  url: "https://leetcode.com/problems/two-sum/",
  submittedAt: "2026-11-20T10:00:00.000Z",
  status: "Accepted",
  ...overrides,
});

describe("solution-manifest.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getRepositoryTree).mockResolvedValue([]);
    vi.mocked(getFile).mockResolvedValue(null);
    vi.mocked(upsertFile).mockResolvedValue({
      path: "leetcode-sync/manifest.json",
      sha: "manifest-sha",
    } as Awaited<ReturnType<typeof upsertFile>>);
  });

  it("creates a manifest from existing repository solutions when no manifest exists", async () => {
    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0001-two-sum/solution.ts"),
      createTreeItem("Medium/0002-add-two-numbers/solution.py"),
    ]);

    const result = await synchronizeSolutionManifest(credentials);

    expect(result).toEqual(
      createManifest([
        createDiscoveredSolution(),
        createDiscoveredSolution({
          problemId: "2",
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          difficulty: "Medium",
          language: "python3",
          languageName: "Python3",
          path: "Medium/0002-add-two-numbers/solution.py",
        }),
      ]),
    );

    expect(upsertFile).toHaveBeenCalledOnce();
  });

  it("preserves existing metadata for discovered solutions", async () => {
    const existingManifest = createManifest([
      createSolution({
        title: "Original Official Title",
        submittedAt: "2026-11-18T10:00:00.000Z",
      }),
    ]);

    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0001-two-sum/solution.ts"),
    ]);

    vi.mocked(getFile).mockResolvedValue(JSON.stringify(existingManifest));

    const result = await synchronizeSolutionManifest(credentials);

    expect(result.solutions[0]?.title).toBe("Original Official Title");
    expect(result.solutions[0]?.submittedAt).toBe("2026-11-18T10:00:00.000Z");
  });

  it("adds new submission metadata to the manifest", async () => {
    const submission = createSubmission();

    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0001-two-sum/solution.ts"),
    ]);

    const result = await synchronizeSolutionManifest(credentials, submission);

    expect(result.solutions).toContainEqual(
      createSolution({
        problemId: "1",
        submittedAt: submission.submittedAt,
      }),
    );
  });

  it("removes solutions that no longer exist in the repository", async () => {
    const existingManifest = createManifest([
      createSolution(),
      createSolution({
        problemId: "2",
        title: "Add Two Numbers",
        slug: "add-two-numbers",
        difficulty: "Medium",
        language: "python3",
        languageName: "Python3",
        path: "Medium/0002-add-two-numbers/solution.py",
      }),
    ]);

    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0001-two-sum/solution.ts"),
    ]);

    vi.mocked(getFile).mockResolvedValue(JSON.stringify(existingManifest));

    const result = await synchronizeSolutionManifest(credentials);

    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]?.path).toBe("Easy/0001-two-sum/solution.ts");
  });

  it("does not overwrite an invalid JSON manifest", async () => {
    vi.mocked(getFile).mockResolvedValue("{ invalid json");

    await expect(synchronizeSolutionManifest(credentials)).rejects.toThrow(
      "GitHub solution manifest contains invalid JSON.",
    );

    expect(upsertFile).not.toHaveBeenCalled();
  });

  it("does not overwrite a manifest with an unsupported version", async () => {
    vi.mocked(getFile).mockResolvedValue(
      JSON.stringify({
        version: 2,
        solutions: [],
      }),
    );

    await expect(synchronizeSolutionManifest(credentials)).rejects.toThrow(
      "GitHub solution manifest has an unsupported format.",
    );

    expect(upsertFile).not.toHaveBeenCalled();
  });

  it("does not overwrite a manifest containing invalid entries", async () => {
    vi.mocked(getFile).mockResolvedValue(
      JSON.stringify({
        version: 1,
        solutions: [
          {
            problemId: "1",
            title: "Two Sum",
            slug: "two-sum",
            difficulty: "Impossible",
            language: "typescript",
            languageName: "TypeScript",
            path: "Easy/0001-two-sum/solution.ts",
          },
        ],
      }),
    );

    await expect(synchronizeSolutionManifest(credentials)).rejects.toThrow(
      "GitHub solution manifest contains an invalid entry.",
    );

    expect(upsertFile).not.toHaveBeenCalled();
  });

  it("supports unknown file extensions", async () => {
    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0042-some-problem/solution.xyz"),
    ]);

    const result = await synchronizeSolutionManifest(credentials);

    expect(result.solutions[0]).toMatchObject({
      problemId: "42",
      language: "xyz",
      languageName: "XYZ",
    });
  });

  it("ignores files that do not match the solution path structure", async () => {
    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("README.md"),
      createTreeItem("Easy/0001-two-sum/main.ts"),
      createTreeItem("Other/0002-example/solution.ts"),
      createTreeItem("Easy/0003-example/solution"),
      createTreeItem("Easy/0004-example/solution.ts/extra"),
    ]);

    const result = await synchronizeSolutionManifest(credentials);

    expect(result.solutions).toHaveLength(0);
  });

  it("sorts manifest entries by path", async () => {
    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Medium/0002-add-two-numbers/solution.py"),
      createTreeItem("Easy/0001-two-sum/solution.ts"),
    ]);

    const result = await synchronizeSolutionManifest(credentials);

    expect(result.solutions.map((solution) => solution.path)).toEqual([
      "Easy/0001-two-sum/solution.ts",
      "Medium/0002-add-two-numbers/solution.py",
    ]);
  });

  it("writes the generated manifest as formatted JSON", async () => {
    vi.mocked(getRepositoryTree).mockResolvedValue([
      createTreeItem("Easy/0001-two-sum/solution.ts"),
    ]);

    await synchronizeSolutionManifest(credentials);

    const call = vi.mocked(upsertFile).mock.calls[0]?.[0];

    expect(call?.path).toBe("leetcode-sync/manifest.json");
    expect(call?.message).toBe("chore: synchronize solution manifest");
    expect(call?.content).toBe(
      JSON.stringify(createManifest([createDiscoveredSolution()]), null, 2),
    );
  });
});

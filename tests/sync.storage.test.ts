import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSyncHistory,
  recoverInterruptedSyncs,
} from "@/storage/sync.storage";

const { storageGet, storageSet } = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
      },
    },
  },
}));

const STORAGE_KEY = "sync-history";

describe("sync.storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageSet.mockResolvedValue(undefined);
  });

  it("should recover interrupted syncing records", async () => {
    const history = [
      {
        submissionId: "123",
        filePath: "Easy/two-sum/solution.ts",
        status: "syncing",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
    ];

    storageGet.mockResolvedValue({
      [STORAGE_KEY]: history,
    });

    await recoverInterruptedSyncs();

    expect(storageSet).toHaveBeenCalledWith({
      [STORAGE_KEY]: [
        expect.objectContaining({
          submissionId: "123",
          status: "failed",
          error:
            "Sync interrupted because the extension service worker restarted.",
        }),
      ],
    });
  });

  it("should preserve synced and failed records", async () => {
    const history = [
      {
        submissionId: "123",
        filePath: "Easy/two-sum/solution.ts",
        status: "synced",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
      {
        submissionId: "456",
        filePath: "Medium/add-two/solution.ts",
        status: "failed",
        updatedAt: "2026-01-01T10:00:00.000Z",
        error: "GitHub unavailable",
      },
    ];

    storageGet.mockResolvedValue({
      [STORAGE_KEY]: history,
    });

    await recoverInterruptedSyncs();

    expect(storageSet).not.toHaveBeenCalled();
  });

  it("should not write storage when there are no interrupted records", async () => {
    storageGet.mockResolvedValue({
      [STORAGE_KEY]: [],
    });

    await recoverInterruptedSyncs();

    expect(storageSet).not.toHaveBeenCalled();
  });

  it("should return sync history", async () => {
    const history = [
      {
        submissionId: "123",
        filePath: "Easy/two-sum/solution.ts",
        status: "synced",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
    ];

    storageGet.mockResolvedValue({
      [STORAGE_KEY]: history,
    });

    await expect(getSyncHistory()).resolves.toEqual(history);
  });
});

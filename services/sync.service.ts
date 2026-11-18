import { upsertFile } from "@/services/github.service";
import { getSettings } from "@/storage/settings.storage";
import { getSyncRecord, saveSyncRecord } from "@/storage/sync.storage";
import type { Submission } from "@/types/submission.types";
import type { SyncRecord, SyncResult, SyncTrigger } from "@/types/sync.types";
import { getSolutionPath } from "@/utils/solution-path";

function createRecord(
  submissionId: string,
  filePath: string,
  status: SyncRecord["status"],
  error?: string,
): SyncRecord {
  return {
    submissionId,
    filePath,
    status,
    updatedAt: new Date().toISOString(),
    ...(status === "synced" ? { syncedAt: new Date().toISOString() } : {}),
    ...(error ? { error } : {}),
  };
}

export async function performSyncSubmission(
  submission: Submission,
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const settings = await getSettings();
  const filePath = getSolutionPath(submission);

  if (trigger === "automatic" && settings.syncMode === "manual") {
    return {
      success: false,
      status: "pending",
      filePath,
      message: "Automatic sync is disabled.",
    };
  }

  if (!settings.token || !settings.owner || !settings.repo) {
    throw new Error("GitHub settings are incomplete.");
  }

  const previousRecord = await getSyncRecord(submission.submissionId);

  if (previousRecord?.status === "synced") {
    return {
      success: true,
      status: "synced",
      filePath: previousRecord.filePath,
      message: "This submission has already been synced.",
    };
  }

  await saveSyncRecord(
    createRecord(submission.submissionId, filePath, "syncing"),
  );

  try {
    await upsertFile({
      token: settings.token,
      owner: settings.owner,
      repo: settings.repo,
      path: filePath,
      content: submission.code,
      message: `Add ${submission.title} (${submission.languageName})`,
    });

    await saveSyncRecord(
      createRecord(submission.submissionId, filePath, "synced"),
    );

    return {
      success: true,
      status: "synced",
      filePath,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";

    await saveSyncRecord(
      createRecord(submission.submissionId, filePath, "failed", message),
    );

    return {
      success: false,
      status: "failed",
      filePath,
      message,
    };
  }
}

let syncQueue: Promise<void> = Promise.resolve();

export function syncSubmission(
  submission: Submission,
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const task = syncQueue.then(() => performSyncSubmission(submission, trigger));

  syncQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

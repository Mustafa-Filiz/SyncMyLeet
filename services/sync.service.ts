import { upsertFile } from "@/services/github.service";
import { getSettings } from "@/storage/settings.storage";
import { getSyncRecord, saveSyncRecord } from "@/storage/sync.storage";
import type { Submission } from "@/types/submission.types";
import type { SyncRecord, SyncResult, SyncTrigger } from "@/types/sync.types";
import { getSolutionPath } from "@/utils/solution-path";
import { getSubmissionHistory } from "@/storage/submission.storage";
import {
  getLastGeneratedReadme,
  saveGeneratedReadme,
} from "@/storage/readme.storage";
import { generateReadme } from "@/utils/readme-generator";

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

  if (trigger === "manual" && settings.syncMode === "automatic") {
    return {
      success: false,
      status: "pending",
      filePath,
      message: "Manual sync is disabled.",
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

    const history = await getSubmissionHistory();
    const readme = generateReadme(history);

    const repositoryKey = `${settings.owner}/${settings.repo}`;
    const previousReadme = await getLastGeneratedReadme(repositoryKey);

    if (readme !== previousReadme) {
      await upsertFile({
        token: settings.token,
        owner: settings.owner,
        repo: settings.repo,
        path: "README.md",
        content: readme,
        message: "docs: update LeetCode solutions README",
      });

      await saveGeneratedReadme(repositoryKey, readme);
    }

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

const inFlightSyncs = new Map<string, Promise<SyncResult>>();

export function syncSubmission(
  submission: Submission,
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const existingTask = inFlightSyncs.get(submission.submissionId);

  if (existingTask) {
    return existingTask;
  }

  const task = syncQueue.then(() => performSyncSubmission(submission, trigger));

  inFlightSyncs.set(submission.submissionId, task);

  syncQueue = task.then(
    () => undefined,
    () => undefined,
  );

  const cleanup = () => {
    if (inFlightSyncs.get(submission.submissionId) === task) {
      inFlightSyncs.delete(submission.submissionId);
    }
  };

  void task.then(cleanup, cleanup);

  return task;
}

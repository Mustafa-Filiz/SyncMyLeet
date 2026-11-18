import type { Submission } from "@/types/submission.types";
import { browser } from "wxt/browser";

const LATEST_SUBMISSION_KEY = "latest-submission";
const PROCESSED_IDS_KEY = "processed-submission-ids";

export async function getLatestSubmission(): Promise<Submission | null> {
  const result = await browser.storage.local.get(LATEST_SUBMISSION_KEY);

  return (result[LATEST_SUBMISSION_KEY] as Submission) ?? null;
}

export async function hasProcessedSubmission(
  submissionId: string,
): Promise<boolean> {
  const result = await browser.storage.local.get(PROCESSED_IDS_KEY);

  const ids: string[] = (result[PROCESSED_IDS_KEY] as string[]) ?? [];

  return ids.includes(submissionId);
}

export async function saveLatestSubmission(
  submission: Submission,
): Promise<void> {
  const result = await browser.storage.local.get(PROCESSED_IDS_KEY);

  const existingIds: string[] = (result[PROCESSED_IDS_KEY] as string[]) ?? [];

  const updatedIds = [
    submission.submissionId,
    ...existingIds.filter((id) => id !== submission.submissionId),
  ].slice(0, 100);

  await browser.storage.local.set({
    [LATEST_SUBMISSION_KEY]: submission,
    [PROCESSED_IDS_KEY]: updatedIds,
  });
}

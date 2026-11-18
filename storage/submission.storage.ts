import type { Submission } from "@/types/submission.types";
import { browser } from "wxt/browser";

const LATEST_SUBMISSION_KEY = "latest-submission";
const SUBMISSION_HISTORY_KEY = "submission-history";
const PROCESSED_IDS_KEY = "processed-submission-ids";

const MAX_HISTORY = 200;

export async function getLatestSubmission(): Promise<Submission | null> {
  const result = await browser.storage.local.get(LATEST_SUBMISSION_KEY);

  return (result[LATEST_SUBMISSION_KEY] as Submission) ?? null;
}

export async function getSubmissionHistory(): Promise<Submission[]> {
  const result = await browser.storage.local.get(SUBMISSION_HISTORY_KEY);

  return (result[SUBMISSION_HISTORY_KEY] as Submission[] | undefined) ?? [];
}

export async function getSubmissionById(
  submissionId: string,
): Promise<Submission | null> {
  const history = await getSubmissionHistory();

  return (
    history.find((submission) => submission.submissionId === submissionId) ??
    null
  );
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
  const result = await browser.storage.local.get([
    PROCESSED_IDS_KEY,
    SUBMISSION_HISTORY_KEY,
  ]);

  const existingIds: string[] = (result[PROCESSED_IDS_KEY] as string[]) ?? [];

  const existingHistory: Submission[] =
    (result[SUBMISSION_HISTORY_KEY] as Submission[]) ?? [];

  const updatedIds = [
    submission.submissionId,
    ...existingIds.filter((id) => id !== submission.submissionId),
  ].slice(0, MAX_HISTORY);

  const updatedHistory = [
    submission,
    ...existingHistory.filter(
      (item) => item.submissionId !== submission.submissionId,
    ),
  ].slice(0, MAX_HISTORY);

  await browser.storage.local.set({
    [LATEST_SUBMISSION_KEY]: submission,
    [SUBMISSION_HISTORY_KEY]: updatedHistory,
    [PROCESSED_IDS_KEY]: updatedIds,
  });
}

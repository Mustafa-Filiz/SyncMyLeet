import type { SyncRecord } from "@/types/sync.types";
import { browser } from "wxt/browser";

const STORAGE_KEY = "sync-history";
const MAX_RECORDS = 200;

export async function getSyncHistory(): Promise<SyncRecord[]> {
  const result = await browser.storage.local.get(STORAGE_KEY);

  return (result[STORAGE_KEY] as SyncRecord[] | undefined) ?? [];
}

export async function getSyncRecord(
  submissionId: string,
): Promise<SyncRecord | undefined> {
  const history = await getSyncHistory();

  return history.find((record) => record.submissionId === submissionId);
}

export async function saveSyncRecord(record: SyncRecord): Promise<void> {
  const history = await getSyncHistory();

  const updatedHistory = [
    record,
    ...history.filter((item) => item.submissionId !== record.submissionId),
  ].slice(0, MAX_RECORDS);

  await browser.storage.local.set({
    [STORAGE_KEY]: updatedHistory,
  });
}

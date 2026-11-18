export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface SyncRecord {
  submissionId: string;
  filePath: string;
  status: SyncStatus;
  syncedAt?: string;
  error?: string;
  updatedAt: string;
}

export type SyncTrigger = "automatic" | "manual";

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  filePath: string;
  message?: string;
}

import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { getLatestSubmission } from "@/storage/submission.storage";
import { getSyncRecord } from "@/storage/sync.storage";

import type { Submission } from "@/types/submission.types";
import type { SyncRecord } from "@/types/sync.types";

export default function LatestSubmission() {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [syncRecord, setSyncRecord] = useState<SyncRecord | undefined>();
  const [isRequestingSync, setIsRequestingSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const refresh = useCallback(async () => {
    const latest = await getLatestSubmission();

    setSubmission(latest);

    if (latest) {
      const record = await getSyncRecord(latest.submissionId);
      setSyncRecord(record);
    } else {
      setSyncRecord(undefined);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const listener = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === "local" &&
        (changes["latest-submission"] || changes["sync-history"])
      ) {
        void refresh();
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, [refresh]);

  const handleManualSync = async () => {
    if (!submission || isRequestingSync) return;

    setIsRequestingSync(true);
    setSyncMessage("");

    try {
      const response = await browser.runtime.sendMessage({
        type: "MANUAL_SYNC_REQUEST",
        submissionId: submission.submissionId,
      });

      if (!response?.success) {
        setSyncMessage(response?.error ?? "Could not sync submission.");
      }

      await refresh();
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Could not sync submission.",
      );
    } finally {
      setIsRequestingSync(false);
    }
  };

  if (!submission) {
    return (
      <section className="latest-submission empty-state">
        <h2>Latest Submission</h2>
        <p>No submissions captured yet.</p>
        <span>Submit an accepted solution on LeetCode to get started.</span>
      </section>
    );
  }

  const syncStatus = syncRecord?.status ?? "pending";

  const statusLabels = {
    pending: "Not synced",
    syncing: "Syncing...",
    synced: "Synced to GitHub",
    failed: "Sync failed",
  };

  return (
    <section className="latest-submission">
      <h2>Latest Submission</h2>

      <h3>{submission.title}</h3>

      <div className="submission-info">
        <span>{submission.difficulty}</span>
        <span>{submission.languageName}</span>
      </div>

      <p>Runtime: {submission.runtime ?? "N/A"}</p>

      <p>Memory: {submission.memory ?? "N/A"}</p>

      <p>Topics: {submission.topics.map((topic) => topic.name).join(", ")}</p>

      <a href={submission.url} target="_blank" rel="noreferrer">
        View submission
      </a>

      <div className="sync-status">
        <p>
          GitHub: <strong>{statusLabels[syncStatus]}</strong>
        </p>

        {syncRecord?.filePath && <p>Path: {syncRecord.filePath}</p>}

        {syncRecord?.error && <p role="alert">{syncRecord.error}</p>}

        {syncMessage && <p role="alert">{syncMessage}</p>}

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isRequestingSync || syncStatus === "syncing"}
        >
          {isRequestingSync || syncStatus === "syncing"
            ? "Syncing..."
            : syncStatus === "synced"
              ? "Sync again"
              : syncStatus === "failed"
                ? "Retry sync"
                : "Sync to GitHub"}
        </button>
      </div>

      <details>
        <summary>View source code</summary>

        <pre>
          <code>{submission.code}</code>
        </pre>
      </details>
    </section>
  );
}

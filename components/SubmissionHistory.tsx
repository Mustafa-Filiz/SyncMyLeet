import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";

import { getSubmissionHistory } from "@/storage/submission.storage";
import { getSyncHistory } from "@/storage/sync.storage";

import type { Submission } from "@/types/submission.types";
import type { SyncRecord } from "@/types/sync.types";

type DifficultyFilter = "all" | "Easy" | "Medium" | "Hard";

export default function SubmissionHistory() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [language, setLanguage] = useState("all");

  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [history, records] = await Promise.all([
      getSubmissionHistory(),
      getSyncHistory(),
    ]);

    setSubmissions(history);
    setSyncRecords(records);
  }, []);

  useEffect(() => {
    void refresh();

    const listener = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === "local" &&
        (changes["submission-history"] || changes["sync-history"])
      ) {
        void refresh();
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, [refresh]);

  const languages = useMemo(
    () =>
      [
        ...new Set(submissions.map((submission) => submission.languageName)),
      ].sort(),
    [submissions],
  );

  const filteredSubmissions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return submissions.filter((submission) => {
      const matchesSearch =
        !normalizedSearch ||
        submission.title.toLowerCase().includes(normalizedSearch) ||
        submission.slug.toLowerCase().includes(normalizedSearch);

      const matchesDifficulty =
        difficulty === "all" || submission.difficulty === difficulty;

      const matchesLanguage =
        language === "all" || submission.languageName === language;

      return matchesSearch && matchesDifficulty && matchesLanguage;
    });
  }, [submissions, search, difficulty, language]);

  function getSyncStatus(submissionId: string) {
    return syncRecords.find((record) => record.submissionId === submissionId);
  }

  async function handleSync(submissionId: string) {
    if (syncingIds.includes(submissionId)) return;

    setError("");
    setSyncingIds((current) => [...current, submissionId]);

    try {
      const response = await browser.runtime.sendMessage({
        type: "MANUAL_SYNC_REQUEST",
        submissionId,
      });

      if (!response?.success) {
        setError(response?.error ?? "Could not sync submission.");
      }

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sync submission.",
      );
    } finally {
      setSyncingIds((current) => current.filter((id) => id !== submissionId));

      await refresh();
    }
  }

  return (
    <section className="submission-history">
      <header>
        <h2>Submission History</h2>
        <span>{submissions.length} submissions</span>
      </header>

      <div className="history-filters">
        <input
          type="search"
          placeholder="Search problems..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={difficulty}
          onChange={(event) =>
            setDifficulty(event.target.value as DifficultyFilter)
          }
        >
          <option value="all">All difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="all">All languages</option>

          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {filteredSubmissions.length === 0 ? (
        <p>No submissions found.</p>
      ) : (
        <div className="history-list">
          {filteredSubmissions.map((submission) => {
            const record = getSyncStatus(submission.submissionId);
            const isSyncing = syncingIds.includes(submission.submissionId);

            const status = record?.status ?? "pending";

            return (
              <article key={submission.submissionId} className="history-item">
                <div className="history-item-header">
                  <div>
                    <h3>{submission.title}</h3>

                    <div className="submission-info">
                      <span>{submission.difficulty}</span>
                      <span>{submission.languageName}</span>
                    </div>
                  </div>

                  <span className={`sync-badge ${status}`}>
                    {isSyncing ? "Syncing..." : status}
                  </span>
                </div>

                <p>
                  Submitted: {new Date(submission.submittedAt).toLocaleString()}
                </p>

                {record?.filePath && (
                  <p className="file-path">{record.filePath}</p>
                )}

                {record?.error && <p className="error">{record.error}</p>}

                <div className="history-actions">
                  <a href={submission.url} target="_blank" rel="noreferrer">
                    View submission
                  </a>

                  <button
                    type="button"
                    disabled={isSyncing || status === "syncing"}
                    onClick={() => void handleSync(submission.submissionId)}
                  >
                    {isSyncing
                      ? "Syncing..."
                      : status === "synced"
                        ? "Sync again"
                        : status === "failed"
                          ? "Retry"
                          : "Sync to GitHub"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { getLatestSubmission } from "../storage/submission.storage";

import type { Submission } from "../types/submission.types";

export default function LatestSubmission() {
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    getLatestSubmission().then(setSubmission);

    const listener = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === "local" && changes["latest-submission"]) {
        setSubmission(
          (changes["latest-submission"].newValue as Submission) ?? null,
        );
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  if (!submission) {
    return (
      <section>
        <h2>Latest Submission</h2>
        <p>No submissions captured yet.</p>
      </section>
    );
  }

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

      <details>
        <summary>View source code</summary>

        <pre>
          <code>{submission.code}</code>
        </pre>
      </details>
    </section>
  );
}

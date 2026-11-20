import { waitForAcceptedSubmission } from "@/services/leetcode.service";
import { browser } from "wxt/browser";

const SUBMISSION_URL_REGEX = /\/submissions\/(?:detail\/)?(\d+)/;
const RETRY_DELAY = 1500;

function getSubmissionId(url: string): string | null {
  const match = url.match(SUBMISSION_URL_REGEX);

  return match?.[1] ?? null;
}

export default defineContentScript({
  matches: ["https://leetcode.com/*"],

  runAt: "document_idle",

  main(ctx) {
    const processedIds = new Set<string>();
    const retryTimers = new Map<string, number>();

    let currentUrl = "";

    function scheduleRetry(submissionId: string, url: string) {
      if (retryTimers.has(submissionId)) {
        return;
      }

      const timer = window.setTimeout(() => {
        retryTimers.delete(submissionId);
        void captureSubmission(submissionId, url);
      }, RETRY_DELAY);

      retryTimers.set(submissionId, timer);
    }

    async function captureSubmission(submissionId: string, url: string) {
      if (processedIds.has(submissionId)) {
        return;
      }

      processedIds.add(submissionId);

      try {
        console.info("[Sync My Leet] Submission detected:", submissionId);

        const submission = await waitForAcceptedSubmission(submissionId, url);

        if (!submission) {
          console.info(
            "[Sync My Leet] Submission is not ready yet. Retrying...",
          );

          processedIds.delete(submissionId);
          scheduleRetry(submissionId, url);

          return;
        }

        const response = await browser.runtime.sendMessage({
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission,
        });

        if (!response?.success) {
          throw new Error(response?.error ?? "Failed to save submission.");
        }

        console.info("[Sync My Leet] Submission captured:", submission.title);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("Extension context invalidated")) {
          console.warn(
            "[Sync My Leet] Extension context was invalidated. Tracking stopped.",
          );

          stopTracking();
          return;
        }

        console.error("[Sync My Leet] Capture failed:", error);

        processedIds.delete(submissionId);
        scheduleRetry(submissionId, url);
      }
    }

    function checkUrl() {
      const url = window.location.href;

      if (url === currentUrl) {
        return;
      }

      currentUrl = url;

      const submissionId = getSubmissionId(url);

      if (!submissionId) {
        return;
      }

      void captureSubmission(submissionId, url);
    }

    checkUrl();

    const interval = window.setInterval(checkUrl, 500);
    let isStopped = false;

    function stopTracking() {
      if (isStopped) return;

      isStopped = true;

      window.clearInterval(interval);

      retryTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });

      retryTimers.clear();
    }

    ctx.onInvalidated(stopTracking);
  },
});

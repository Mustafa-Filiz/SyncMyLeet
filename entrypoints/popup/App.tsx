import LatestSubmission from "@/components/LatestSubmission";
import SubmissionHistory from "@/components/SubmissionHistory";
import { getSettings, clearSettings } from "@/storage/settings.storage";
import type { GitHubSettings } from "@/types/settings.types";
import { browser } from "wxt/browser";
import { useEffect, useState } from "react";

const DEFAULT_SETTINGS: GitHubSettings = {
  token: "",
  owner: "",
  repo: "",
  syncMode: "both",
};

interface GitHubResponse {
  success: boolean;
  username?: string;
  repository?: string;
  message?: string;
  error?: string;
}

export default function App() {
  const [settings, setSettings] = useState<GitHubSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof GitHubSettings>(
    key: K,
    value: GitHubSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function sendGitHubMessage(
    type: "GITHUB_CONNECT" | "GITHUB_TEST_SYNC",
  ): Promise<GitHubResponse> {
    const response = (await browser.runtime.sendMessage({
      type,
      settings,
    })) as GitHubResponse;

    if (!response?.success) {
      throw new Error(response?.error ?? "GitHub operation failed.");
    }

    return response;
  }

  async function handleConnect() {
    setBusy(true);
    setStatus("");

    try {
      const result = await sendGitHubMessage("GITHUB_CONNECT");

      setStatus(
        `Connected as ${result.username}. Repository: ${result.repository}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestSync() {
    setBusy(true);
    setStatus("");

    try {
      const result = await sendGitHubMessage("GITHUB_TEST_SYNC");

      setStatus(result.message ?? "Test file successfully synced!");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Synchronization failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setStatus("");

    try {
      await clearSettings();
      setSettings(DEFAULT_SETTINGS);
      setStatus("GitHub disconnected.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not disconnect GitHub.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="app loading">Loading Sync My Leet...</main>;
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/icon/48.png" alt="app-icon" />
          <div>
            <h1>Sync My Leet</h1>
            <p>LeetCode solutions, synced to GitHub.</p>
          </div>
        </div>

        <span
          className={`connection-indicator ${
            settings.token ? "connected" : "disconnected"
          }`}
        >
          <span className="connection-dot" />
          {settings.token ? "Connected" : "Not connected"}
        </span>
      </header>

      <section className="settings-card">
        <details
          className="settings-details"
          open={settingsOpen}
          onToggle={(event) => {
            setSettingsOpen(event.currentTarget.open);
          }}
        >
          <summary>
            <div>
              <strong>GitHub settings</strong>
              <span>Repository and synchronization preferences</span>
            </div>
            <span className="settings-chevron">⌄</span>
          </summary>

          <div className="form">
            <label>
              GitHub Personal Access Token
              <input
                type="password"
                value={settings.token}
                placeholder="github_pat_..."
                onChange={(event) => updateField("token", event.target.value)}
              />
            </label>

            <div className="grid">
              <label>
                Owner
                <input
                  value={settings.owner}
                  placeholder="username"
                  onChange={(event) => updateField("owner", event.target.value)}
                />
              </label>

              <label>
                Repository
                <input
                  value={settings.repo}
                  placeholder="leetcode-solutions"
                  onChange={(event) => updateField("repo", event.target.value)}
                />
              </label>
            </div>

            <label>
              Synchronization mode
              <select
                value={settings.syncMode}
                onChange={(event) =>
                  updateField(
                    "syncMode",
                    event.target.value as GitHubSettings["syncMode"],
                  )
                }
              >
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="both">Automatic + Manual</option>
              </select>
            </label>

            <button disabled={busy} onClick={handleConnect}>
              {busy ? "Connecting..." : "Save & Validate"}
            </button>

            <button
              className="secondary"
              disabled={busy || !settings.token}
              onClick={handleTestSync}
            >
              {busy ? "Processing..." : "Send Test File"}
            </button>

            {settings.token && (
              <button
                className="danger"
                disabled={busy}
                onClick={handleDisconnect}
              >
                Disconnect GitHub
              </button>
            )}

            {status && (
              <div className="status" role="status">
                {status}
              </div>
            )}
          </div>
        </details>
      </section>

      <LatestSubmission />
      <SubmissionHistory />

      <footer className="app-footer">
        <span>Sync My Leet</span>
        <span>Made for LeetCode developers</span>
      </footer>
    </main>
  );
}

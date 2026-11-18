import LatestSubmission from "@/components/LatestSubmission";
import { GitHubSettingsSchema } from "@/schemas/settings.schema";
import {
  validateToken,
  validateRepository,
  upsertFile,
} from "@/services/github.service";
import {
  getSettings,
  saveSettings,
  clearSettings,
} from "@/storage/settings.storage";
import type { GitHubSettings } from "@/types/settings.types";
import { useEffect, useState } from "react";

const DEFAULT_SETTINGS: GitHubSettings = {
  token: "",
  owner: "",
  repo: "",
  syncMode: "both",
};

export default function App() {
  const [settings, setSettings] = useState<GitHubSettings>(DEFAULT_SETTINGS);

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

  async function validateConnection() {
    const parsed = GitHubSettingsSchema.safeParse(settings);

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid settings");
    }

    const user = await validateToken(settings.token);

    const repository = await validateRepository(
      settings.token,
      settings.owner,
      settings.repo,
    );

    if (!repository.permissions?.push) {
      throw new Error("You do not have write access to this repository.");
    }

    await saveSettings(settings);

    return {
      username: user.login,
      repository: repository.full_name,
    };
  }

  async function handleConnect() {
    setBusy(true);
    setStatus("");

    try {
      const result = await validateConnection();

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
      await validateConnection();

      await upsertFile({
        token: settings.token,
        owner: settings.owner,
        repo: settings.repo,

        path: "leetcode-sync/connection-test.md",

        content: [
          "# LeetCode Sync",
          "",
          "GitHub integration is working!",
          "",
          `Last tested: ${new Date().toISOString()}`,
        ].join("\n"),

        message: "test: verify GitHub integration",
      });

      setStatus("Test file successfully synced!");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Synchronization failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    await clearSettings();
    setSettings(DEFAULT_SETTINGS);
    setStatus("GitHub disconnected.");
  }

  if (loading) {
    return <main>Loading...</main>;
  }

  return (
    <main className="app">
      <LatestSubmission />
      <header className="header">
        <div>
          <h1>Sync My Leet</h1>
          <p>Sync your solutions to GitHub</p>
        </div>
      </header>

      <section className="form">
        <label>
          GitHub Token
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

        <button className="secondary" disabled={busy} onClick={handleTestSync}>
          Send Test File
        </button>

        <button className="danger" disabled={busy} onClick={handleDisconnect}>
          Disconnect GitHub
        </button>

        {status && (
          <div className="status" role="status">
            {status}
          </div>
        )}
      </section>
    </main>
  );
}

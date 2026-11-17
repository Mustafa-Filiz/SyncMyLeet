import { browser } from "wxt/browser";
import type { GitHubSettings } from "../types/settings.types";

const STORAGE_KEY = "github-settings";

const DEFAULT_SETTINGS: GitHubSettings = {
  token: "",
  owner: "",
  repo: "",
  syncMode: "both",
};

export async function getSettings(): Promise<GitHubSettings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<GitHubSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
  };
}

export async function saveSettings(settings: GitHubSettings): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY]: settings,
  });
}

export async function clearSettings(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

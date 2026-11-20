import { browser } from "wxt/browser";

const SETTINGS_PANEL_OPEN_KEY = "settings-panel-open";

export async function getSettingsPanelOpen(): Promise<boolean> {
  const result = await browser.storage.local.get(SETTINGS_PANEL_OPEN_KEY);
  const stored = result[SETTINGS_PANEL_OPEN_KEY];

  return typeof stored === "boolean" ? stored : true;
}

export async function saveSettingsPanelOpen(isOpen: boolean): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_PANEL_OPEN_KEY]: isOpen,
  });
}

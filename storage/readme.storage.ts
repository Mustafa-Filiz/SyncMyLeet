import { browser } from "wxt/browser";

function getStorageKey(repositoryKey: string): string {
  return `generated-readme:${repositoryKey}`;
}

export async function getLastGeneratedReadme(
  repositoryKey: string,
): Promise<string | null> {
  const key = getStorageKey(repositoryKey);
  const result = await browser.storage.local.get(key);

  return (result[key] as string | undefined) ?? null;
}

export async function saveGeneratedReadme(
  repositoryKey: string,
  content: string,
): Promise<void> {
  const key = getStorageKey(repositoryKey);

  await browser.storage.local.set({
    [key]: content,
  });
}

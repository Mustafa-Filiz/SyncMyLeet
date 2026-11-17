import type { GitHubRepository } from "../types/settings.types";

import { encodeBase64 } from "../utils/base64";
import { encodeGitHubPath } from "../utils/github-path";

const API_URL = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

interface GitHubFileResponse {
  sha: string;
  path: string;
}

interface UpsertFileParams {
  token: string;
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
}

async function githubRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,

    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new GitHubApiError(
      error?.message ?? "GitHub request failed",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export async function validateToken(token: string) {
  return githubRequest<{
    login: string;
    avatar_url: string;
  }>("/user", token);
}

export async function validateRepository(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubRepository> {
  return githubRequest<GitHubRepository>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
  );
}

export async function upsertFile({
  token,
  owner,
  repo,
  path,
  content,
  message,
}: UpsertFileParams) {
  const encodedPath = encodeGitHubPath(path);

  const endpoint =
    `/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodedPath}`;

  let existingSha: string | undefined;

  try {
    const existing = await githubRequest<GitHubFileResponse>(endpoint, token);

    existingSha = existing.sha;
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) {
      throw error;
    }
  }

  return githubRequest<GitHubFileResponse>(endpoint, token, {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
}

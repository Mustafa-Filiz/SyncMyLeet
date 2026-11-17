import type { GitHubRepository } from "@/types/settings.types";
import { encodeBase64 } from "@/utils/base64";
import { encodeGitHubPath } from "@/utils/github-path";

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

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubFile {
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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new GitHubApiError(
      data?.message ?? "GitHub API request failed",
      response.status,
    );
  }

  return data as T;
}

export async function validateToken(token: string): Promise<GitHubUser> {
  return githubRequest<GitHubUser>("/user", token);
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
  const endpoint =
    `/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodeGitHubPath(path)}`;

  let existingSha: string | undefined;

  try {
    const existing = await githubRequest<GitHubFile>(endpoint, token);

    existingSha = existing.sha;
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) {
      throw error;
    }
  }

  return githubRequest<GitHubFile>(endpoint, token, {
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

import type { GitHubRepository } from "@/types/settings.types";
import { decodeBase64, encodeBase64 } from "@/utils/base64";
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

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContent {
  content: string;
  encoding: string;
  path: string;
  sha: string;
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

export async function getRepositoryTree({
  token,
  owner,
  repo,
}: {
  token: string;
  owner: string;
  repo: string;
}): Promise<GitHubTreeItem[]> {
  const repository = await validateRepository(token, owner, repo);

  const branch = await githubRequest<{
    commit: { commit: { tree: { sha: string } } };
  }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(repository.default_branch)}`,
    token,
  );

  const tree = await githubRequest<GitHubTreeResponse>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${branch.commit.commit.tree.sha}?recursive=1`,
    token,
  );

  if (tree.truncated) {
    throw new Error(
      "Repository is too large to retrieve its complete file tree.",
    );
  }

  return tree.tree.filter((item) => item.type === "blob");
}

export async function getFile({
  token,
  owner,
  repo,
  path,
}: {
  token: string;
  owner: string;
  repo: string;
} & Pick<UpsertFileParams, "path">): Promise<string | null> {
  const endpoint =
    `/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodeGitHubPath(path)}`;

  try {
    const file = await githubRequest<GitHubContent>(endpoint, token);

    if (file.encoding !== "base64") {
      throw new Error(`Unsupported file encoding: ${file.encoding}`);
    }

    // GitHub Contents API response is Base64 encoded.
    return decodeBase64(file.content);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

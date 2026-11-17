export type SyncMode = "automatic" | "manual" | "both";

export interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  syncMode: SyncMode;
}

export interface GitHubRepository {
  full_name: string;
  private: boolean;
  default_branch: string;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

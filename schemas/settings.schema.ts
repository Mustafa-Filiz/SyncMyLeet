import { z } from "zod";

export const GitHubSettingsSchema = z.object({
  token: z.string().min(1, "Token is required"),

  owner: z.string().min(1, "GitHub username is required"),

  repo: z.string().min(1, "Repository name is required"),

  syncMode: z.enum(["automatic", "manual", "both"]),
});

import {
  getFile,
  getRepositoryTree,
  upsertFile,
} from "@/services/github.service";
import type { GitHubTreeItem } from "@/services/github.service";
import type {
  SolutionManifest,
  SolutionManifestEntry,
} from "@/types/manifest.types";
import type { Submission } from "@/types/submission.types";
import { getSolutionPath } from "@/utils/solution-path";

const MANIFEST_PATH = "leetcode-sync/manifest.json";

interface GitHubCredentials {
  token: string;
  owner: string;
  repo: string;
}

const EXTENSION_LANGUAGES: Record<
  string,
  { language: string; languageName: string }
> = {
  sh: { language: "bash", languageName: "Bash" },
  c: { language: "c", languageName: "C" },
  cpp: { language: "c++", languageName: "C++" },
  cs: { language: "csharp", languageName: "C#" },
  go: { language: "golang", languageName: "Go" },
  java: { language: "java", languageName: "Java" },
  js: { language: "javascript", languageName: "JavaScript" },
  kt: { language: "kotlin", languageName: "Kotlin" },
  sql: { language: "mysql", languageName: "SQL" },
  php: { language: "php", languageName: "PHP" },
  py: { language: "python3", languageName: "Python3" },
  rb: { language: "ruby", languageName: "Ruby" },
  rs: { language: "rust", languageName: "Rust" },
  scala: { language: "scala", languageName: "Scala" },
  swift: { language: "swift", languageName: "Swift" },
  ts: { language: "typescript", languageName: "TypeScript" },
};

function isDifficulty(value: string): value is "Easy" | "Medium" | "Hard" {
  return value === "Easy" || value === "Medium" || value === "Hard";
}

function createTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function discoverSolution(item: GitHubTreeItem): SolutionManifestEntry | null {
  const match = item.path.match(
    /^(Easy|Medium|Hard)\/(\d+)-([^/]+)\/solution\.([a-z0-9]+)$/i,
  );

  if (!match) return null;

  const [, difficultyValue, problemId, slug, extension] = match;

  if (!difficultyValue || !problemId || !slug || !extension) {
    return null;
  }

  const difficulty =
    difficultyValue.charAt(0).toUpperCase() +
    difficultyValue.slice(1).toLowerCase();

  if (!isDifficulty(difficulty)) return null;

  const normalizedExtension = extension.toLowerCase();

  const languageInfo = EXTENSION_LANGUAGES[normalizedExtension] ?? {
    language: normalizedExtension,
    languageName: normalizedExtension.toUpperCase(),
  };

  return {
    problemId: String(Number(problemId)),
    title: createTitle(slug),
    slug,
    difficulty,
    language: languageInfo.language,
    languageName: languageInfo.languageName,
    path: item.path,
  };
}

function parseManifest(content: string): SolutionManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("GitHub solution manifest contains invalid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("version" in parsed) ||
    !("solutions" in parsed) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.solutions)
  ) {
    throw new Error("GitHub solution manifest has an unsupported format.");
  }

  for (const entry of parsed.solutions) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.path !== "string" ||
      typeof entry.problemId !== "string" ||
      typeof entry.title !== "string" ||
      typeof entry.slug !== "string" ||
      !isDifficulty(entry.difficulty) ||
      typeof entry.language !== "string" ||
      typeof entry.languageName !== "string" ||
      (entry.submittedAt !== undefined && typeof entry.submittedAt !== "string")
    ) {
      throw new Error("GitHub solution manifest contains an invalid entry.");
    }
  }

  return parsed as SolutionManifest;
}

async function readManifest(
  credentials: GitHubCredentials,
): Promise<SolutionManifest | null> {
  const content = await getFile({
    ...credentials,
    path: MANIFEST_PATH,
  });

  return content === null ? null : parseManifest(content);
}

function mergeSolutions(
  discovered: SolutionManifestEntry[],
  existing: SolutionManifestEntry[],
  submission?: Submission,
): SolutionManifest {
  const existingByPath = new Map(existing.map((entry) => [entry.path, entry]));

  const merged = new Map<string, SolutionManifestEntry>();

  for (const discoveredEntry of discovered) {
    const previous = existingByPath.get(discoveredEntry.path);

    merged.set(
      discoveredEntry.path,
      previous
        ? {
            ...discoveredEntry,
            ...previous,
            path: discoveredEntry.path,
          }
        : discoveredEntry,
    );
  }

  if (submission) {
    const path = getSolutionPath(submission);

    merged.set(path, {
      problemId: submission.frontendId || submission.problemId,
      title: submission.title,
      slug: submission.slug,
      difficulty: submission.difficulty,
      language: submission.language,
      languageName: submission.languageName,
      path,
      submittedAt: submission.submittedAt,
    });
  }

  return {
    version: 1,
    solutions: [...merged.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
  };
}

/**
 * Produces deterministic JSON so formatting and property order
 * differences do not trigger unnecessary GitHub commits.
 */
function serializeManifest(manifest: SolutionManifest): string {
  const normalized: SolutionManifest = {
    version: 1,
    solutions: [...manifest.solutions]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((solution) => ({
        problemId: solution.problemId,
        title: solution.title,
        slug: solution.slug,
        difficulty: solution.difficulty,
        language: solution.language,
        languageName: solution.languageName,
        path: solution.path,
        ...(solution.submittedAt !== undefined
          ? { submittedAt: solution.submittedAt }
          : {}),
      })),
  };

  return JSON.stringify(normalized, null, 2);
}

export async function synchronizeSolutionManifest(
  credentials: GitHubCredentials,
  submission?: Submission,
): Promise<SolutionManifest> {
  const [tree, existingManifest] = await Promise.all([
    getRepositoryTree(credentials),
    readManifest(credentials),
  ]);

  const discovered = tree
    .map(discoverSolution)
    .filter((entry): entry is SolutionManifestEntry => entry !== null);

  const manifest = mergeSolutions(
    discovered,
    existingManifest?.solutions ?? [],
    submission,
  );

  const serializedManifest = serializeManifest(manifest);

  const existingSerializedManifest = existingManifest
    ? serializeManifest(existingManifest)
    : null;

  // Only write to GitHub when the manifest actually changes.
  if (serializedManifest !== existingSerializedManifest) {
    await upsertFile({
      ...credentials,
      path: MANIFEST_PATH,
      content: serializedManifest,
      message: "chore: synchronize solution manifest",
    });
  }

  return manifest;
}

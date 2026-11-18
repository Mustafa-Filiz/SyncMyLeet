import { SubmissionSchema } from "../schemas/submission.schema";
import type { Submission } from "@/types/submission.types";

const GRAPHQL_URL = "https://leetcode.com/graphql/";

const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtime
      runtimeDisplay
      memory
      memoryDisplay
      code
      timestamp
      statusCode

      lang {
        name
        verboseName
      }

      question {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty

        topicTags {
          name
          slug
        }
      }
    }
  }
`;

interface LeetCodeGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
}

interface RawSubmissionDetails {
  runtime?: number;
  runtimeDisplay?: string;

  memory?: number;
  memoryDisplay?: string;

  code?: string;
  timestamp?: number | string;
  statusCode?: number | string;

  lang?: {
    name?: string;
    verboseName?: string;
  };

  question?: {
    questionId?: string;
    questionFrontendId?: string;
    title?: string;
    titleSlug?: string;
    difficulty?: string;

    topicTags?: Array<{
      name: string;
      slug: string;
    }>;
  };
}

export class LeetCodeApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LeetCodeApiError";
  }
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify({
      query,
      variables,
      operationName: "submissionDetails",
    }),
  });

  if (!response.ok) {
    throw new LeetCodeApiError(
      `LeetCode HTTP error: ${response.status}`,
      response.status,
    );
  }

  const result = (await response.json()) as LeetCodeGraphQLResponse<T>;

  if (result.errors?.length) {
    throw new LeetCodeApiError(
      result.errors.map((error) => error.message).join("; "),
    );
  }

  if (!result.data) {
    throw new LeetCodeApiError("LeetCode returned an empty response.");
  }

  return result.data;
}

export async function getSubmissionDetails(
  submissionId: string,
): Promise<RawSubmissionDetails> {
  if (!/^\d+$/.test(submissionId)) {
    throw new Error("Invalid submission ID");
  }

  const data = await graphqlRequest<{
    submissionDetails: RawSubmissionDetails | null;
  }>(SUBMISSION_DETAILS_QUERY, {
    submissionId: Number(submissionId),
  });

  if (!data.submissionDetails) {
    throw new LeetCodeApiError("Submission details not found.");
  }

  return data.submissionDetails;
}

function normalizeSubmission(
  raw: RawSubmissionDetails,
  submissionId: string,
  currentUrl: string,
): Submission {
  const question = raw.question;
  const language = raw.lang;

  if (!question || !language) {
    throw new LeetCodeApiError("Missing question or language information.");
  }

  if (raw.code === undefined || raw.code === null || raw.code.length === 0) {
    throw new LeetCodeApiError("Submission source code is empty.");
  }

  const timestamp = Number(raw.timestamp);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new LeetCodeApiError("Invalid submission timestamp.");
  }

  const submission: Submission = {
    submissionId,

    problemId: String(question.questionId),
    frontendId: question.questionFrontendId
      ? String(question.questionFrontendId)
      : undefined,

    title: question.title ?? "",
    slug: question.titleSlug ?? "",

    difficulty: question.difficulty as Submission["difficulty"],

    language: language.name ?? "",
    languageName: language.verboseName ?? language.name ?? "",

    code: raw.code,

    runtime: raw.runtimeDisplay,
    memory: raw.memoryDisplay,

    topics: (question.topicTags ?? []).map((topic) => ({
      name: topic.name,
      slug: topic.slug,
    })),

    url: currentUrl,
    submittedAt: new Date(timestamp * 1000).toISOString(),

    status: "Accepted",
  };

  return SubmissionSchema.parse(submission);
}

const POLLING_INTERVAL = 1000;
const MAX_POLLING_ATTEMPTS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForAcceptedSubmission(
  submissionId: string,
  currentUrl: string,
): Promise<Submission | null> {
  for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
    const raw = await getSubmissionDetails(submissionId);

    const statusCode = Number(raw.statusCode);

    // LeetCode Accepted status code.
    if (statusCode === 10) {
      return normalizeSubmission(raw, submissionId, currentUrl);
    }

    // Pending or not-yet-available submission.
    if (
      raw.statusCode === undefined ||
      raw.statusCode === null ||
      statusCode === 0 ||
      statusCode === 1
    ) {
      await sleep(POLLING_INTERVAL);
      continue;
    }

    // Wrong Answer, TLE, Runtime Error, etc.
    return null;
  }

  throw new LeetCodeApiError("Submission processing timed out.");
}

import { getSubmissionDetails } from "../services/leetcode.service";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("LeetCode Service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should request submission details", async () => {
    const mockResponse = {
      data: {
        submissionDetails: {
          code: "function twoSum() {}",
          statusCode: 10,
          timestamp: 1794960000,

          lang: {
            name: "typescript",
            verboseName: "TypeScript",
          },

          question: {
            questionId: "1",
            questionFrontendId: "1",
            title: "Two Sum",
            titleSlug: "two-sum",
            difficulty: "Easy",
            topicTags: [],
          },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getSubmissionDetails("123456789");

    expect(result.code).toBe("function twoSum() {}");

    expect(result.statusCode).toBe(10);

    expect(fetchMock).toHaveBeenCalledOnce();

    const request = fetchMock.mock.calls[0];

    expect(request?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });

    const body = JSON.parse(request?.[1].body);

    expect(body.variables.submissionId).toBe(123456789);
  });
});

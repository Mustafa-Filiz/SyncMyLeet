import { z } from "zod";

export const SubmissionSchema = z.object({
  submissionId: z.string().min(1),

  problemId: z.string().min(1),
  frontendId: z.string().optional(),

  title: z.string().min(1),
  slug: z.string().min(1),

  difficulty: z.enum(["Easy", "Medium", "Hard"]),

  language: z.string().min(1),
  languageName: z.string().min(1),

  code: z.string().min(1),

  runtime: z.string().optional(),
  memory: z.string().optional(),

  topics: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
    }),
  ),

  url: z.string().url(),
  submittedAt: z.string().datetime(),

  status: z.literal("Accepted"),
});

export type ValidatedSubmission = z.infer<typeof SubmissionSchema>;

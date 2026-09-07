import { z } from "zod";
import { handle, fail } from "@/backend/http";
import { answerQuestion } from "@/backend/ai/assistant";

export const dynamic = "force-dynamic";

const Schema = z.object({ question: z.string().min(2).max(400) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON", 400);
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail("Ask a question (2–400 chars)", 422);
  return handle(() => answerQuestion(parsed.data.question));
}

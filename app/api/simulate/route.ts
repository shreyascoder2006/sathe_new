import { z } from "zod";
import { handle, fail } from "@/backend/http";
import { SIM_SCENARIOS } from "@/lib/constants";
import { runScenario } from "@/backend/sim/scenarios";
import { requireSimulator } from "@/backend/session";

export const dynamic = "force-dynamic";

const Schema = z.object({ scenario: z.enum(SIM_SCENARIOS) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON", 400);
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail("Unknown scenario", 422, parsed.error.flatten());
  return handle(async () => {
    await requireSimulator();
    return runScenario(parsed.data.scenario);
  });
}

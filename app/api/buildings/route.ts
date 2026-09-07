import { handle } from "@/backend/http";
import { getBuildingsLive } from "@/backend/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => getBuildingsLive());
}

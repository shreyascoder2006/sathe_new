import { handle } from "@/backend/http";
import { getCampusMetrics } from "@/backend/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => getCampusMetrics());
}

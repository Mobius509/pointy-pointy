import { submitKidProposal } from "@/lib/v2/kid-ops";
import { opResponse, requireKidFromRequest } from "@/lib/v2/kid-api";

// "Did something extra?" — body: { name }. Parents set the points on approval.
export async function POST(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  return opResponse(await submitKidProposal(auth.ctx, String(body?.name ?? "")));
}

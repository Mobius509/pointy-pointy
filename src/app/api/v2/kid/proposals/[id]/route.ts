import { cancelKidProposal } from "@/lib/v2/kid-ops";
import { opResponse, requireKidFromRequest } from "@/lib/v2/kid-api";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return opResponse(await cancelKidProposal(auth.ctx, id));
}

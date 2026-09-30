import {
  cancelPendingTaskForToday,
  completeTaskForToday,
  recallApprovedTask,
} from "@/lib/v2/kid-ops";
import {
  jsonError,
  opResponse,
  requireKidFromRequest,
} from "@/lib/v2/kid-api";

// POST /api/v2/kid/tasks/:taskId/complete — mark done (pending approval)
// POST /api/v2/kid/tasks/:taskId/cancel   — undo a pending completion
// POST /api/v2/kid/tasks/:taskId/recall   — pull back an approved completion
const ACTIONS = {
  complete: completeTaskForToday,
  cancel: cancelPendingTaskForToday,
  recall: recallApprovedTask,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string; action: string }> },
) {
  const { taskId, action } = await params;
  const op = ACTIONS[action as keyof typeof ACTIONS];
  if (!op) return jsonError("Unknown action.", 404);

  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  return opResponse(await op(auth.ctx, taskId));
}

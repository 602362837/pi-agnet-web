import { NextResponse } from "next/server";
import { archiveGitWorktree, MainWorktreeDirtyError, WorktreeUserError } from "@/lib/git-worktree";
import { destroyRpcSessionsForCwd } from "@/lib/rpc-manager";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { cwd?: unknown; confirmedRisk?: unknown };
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    if (!cwd) return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    if (body.confirmedRisk !== true) {
      return NextResponse.json({ error: "confirmedRisk is required" }, { status: 400 });
    }

    const result = await archiveGitWorktree(cwd, {
      beforeRemove: () => destroyRpcSessionsForCwd(cwd),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof MainWorktreeDirtyError) {
      return NextResponse.json({ error: message, dirtySummary: error.dirtySummary }, { status: 409 });
    }
    const status = error instanceof WorktreeUserError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

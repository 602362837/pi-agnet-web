import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

class GitSwitchUserError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "GitSwitchUserError";
  }
}

async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    return String(stdout);
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "Git command failed").trim();
    throw new GitSwitchUserError(detail || "Git command failed");
  }
}

async function assertGitRepository(cwd: string): Promise<void> {
  try {
    await git(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    throw new GitSwitchUserError(`Not a Git repository: ${cwd}`, 400);
  }
}

async function assertLocalBranchExists(cwd: string, branch: string): Promise<void> {
  try {
    await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
  } catch {
    throw new GitSwitchUserError(`Local branch not found: ${branch}`, 404);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as {
      cwd?: unknown;
      branch?: unknown;
    };

    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";

    if (!cwd) {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!branch) {
      return NextResponse.json({ error: "branch is required" }, { status: 400 });
    }

    await assertGitRepository(cwd);
    await assertLocalBranchExists(cwd, branch);

    const dirtyOutput = (await git(["status", "--porcelain"], cwd)).trim();
    if (dirtyOutput) {
      return NextResponse.json({
        error: "Cannot switch branches while the working tree has uncommitted changes.",
        dirty: true,
        details: dirtyOutput,
      }, { status: 409 });
    }

    await git(["switch", "--", branch], cwd);
    return NextResponse.json({ success: true, branch });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof GitSwitchUserError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

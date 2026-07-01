import { NextResponse } from "next/server";
import { getAllowedRoots, isPathAllowed } from "@/lib/allowed-roots";
import { canonicalizeCwd } from "@/lib/cwd";
import { installTrellisCli } from "@/lib/trellis-manager";
import { readPiWebConfig } from "@/lib/pi-web-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { cwd?: unknown };
    const rawCwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    let cwd: string | undefined;
    if (rawCwd) {
      const allowedRoots = await getAllowedRoots();
      const canonicalCwd = canonicalizeCwd(rawCwd);
      if (!isPathAllowed(rawCwd, allowedRoots) || !isPathAllowed(canonicalCwd, allowedRoots)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      cwd = canonicalCwd;
    }

    const config = readPiWebConfig();
    const result = await installTrellisCli({ cwd, config: config.trellis });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

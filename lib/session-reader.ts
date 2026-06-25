import { SessionManager, buildSessionContext as piBuildSessionContext, getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, rmdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import type { SessionEntry, SessionInfo, SessionContext, SessionTreeNode, AssistantMessage } from "./types";
import type { SessionEntry as PiSessionEntry, SessionInfo as PiSessionInfo } from "@earendil-works/pi-coding-agent";
import { normalizeToolCalls } from "./normalize";
import { getGitMetadataForCwd } from "./git-worktree";
import { canonicalizeCwd, expandCwd } from "./cwd";

export { getAgentDir };

export function getSessionsDir(): string {
  return `${getAgentDir()}/sessions`;
}

export interface DeletedSessionFile {
  id: string;
  path: string;
  cwd: string;
}

function cwdKeys(cwd: string | undefined): Set<string> {
  const keys = new Set<string>();
  if (!cwd) return keys;
  for (const candidate of [cwd, expandCwd(cwd), canonicalizeCwd(cwd)]) {
    if (candidate) keys.add(candidate.replace(/[\\/]+$/, ""));
  }
  return keys;
}

function cwdMatchesAny(cwd: string | undefined, targets: Set<string>): boolean {
  for (const key of cwdKeys(cwd)) {
    if (targets.has(key)) return true;
  }
  return false;
}

function isDeletedWorktreeCwd(cwd: string | undefined): boolean {
  const keys = cwdKeys(cwd);
  if (keys.size === 0) return false;
  if ([...keys].some((key) => existsSync(key))) return false;

  return [...keys].some((key) => {
    const parts = key.split(/[\\/]+/).filter(Boolean);
    return parts.length >= 2 && parts[parts.length - 2].endsWith(".worktrees");
  });
}

function deleteSessionFile(session: Pick<PiSessionInfo, "id" | "path" | "cwd">): DeletedSessionFile | null {
  try {
    unlinkSync(session.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
  }

  invalidateSessionPathCache(session.id);
  try { rmdirSync(dirname(session.path)); } catch { /* keep non-empty session directories */ }
  return { id: session.id, path: session.path, cwd: session.cwd ?? "" };
}

function pruneDeletedWorktreeSessions(piSessions: PiSessionInfo[]): Set<string> {
  const prunedSessionIds = new Set<string>();
  for (const session of piSessions) {
    if (!isDeletedWorktreeCwd(session.cwd)) continue;
    prunedSessionIds.add(session.id);
    deleteSessionFile(session);
  }
  return prunedSessionIds;
}

export async function deleteSessionsForCwd(cwd: string, aliases: string[] = []): Promise<DeletedSessionFile[]> {
  const targets = new Set<string>();
  for (const candidate of [cwd, ...aliases]) {
    for (const key of cwdKeys(candidate)) targets.add(key);
  }

  const deleted: DeletedSessionFile[] = [];
  const piSessions: PiSessionInfo[] = await SessionManager.listAll();
  for (const session of piSessions) {
    if (!cwdMatchesAny(session.cwd, targets)) continue;
    const deletedSession = deleteSessionFile(session);
    if (deletedSession) deleted.push(deletedSession);
  }
  return deleted;
}

export async function listAllSessions(): Promise<SessionInfo[]> {
  let piSessions: PiSessionInfo[] = await SessionManager.listAll();
  const prunedSessionIds = pruneDeletedWorktreeSessions(piSessions);
  if (prunedSessionIds.size > 0) {
    piSessions = piSessions.filter((session) => !prunedSessionIds.has(session.id));
  }
  const pathToId = new Map<string, string>();
  for (const s of piSessions) pathToId.set(s.path, s.id);

  const canonicalCwdBySessionId = new Map<string, string>();
  for (const s of piSessions) {
    if (s.cwd) canonicalCwdBySessionId.set(s.id, canonicalizeCwd(s.cwd));
  }

  const gitByCwd = new Map<string, SessionInfo["git"]>();
  const worktreeByCwd = new Map<string, SessionInfo["worktree"]>();
  await Promise.all([...new Set(canonicalCwdBySessionId.values())].map(async (cwd) => {
    try {
      const metadata = await getGitMetadataForCwd(cwd);
      if (metadata) {
        gitByCwd.set(cwd, metadata);
        if (metadata.isWorktree) {
          worktreeByCwd.set(cwd, {
            isWorktree: true,
            branch: metadata.branch,
            repoRoot: metadata.repoRoot,
            mainWorktreePath: metadata.mainWorktreePath,
            mainWorktreeBranch: metadata.mainWorktreeBranch,
          });
        }
      }
    } catch {
      // Git metadata is best-effort; normal session listing must still work.
    }
  }));

  const cache = getPathCache();
  return piSessions.map((s) => {
    const cwd = canonicalCwdBySessionId.get(s.id) ?? s.cwd;
    // Populate path cache so resolveSessionPath works without a full scan
    cache.set(s.id, s.path);
    return {
      path: s.path,
      id: s.id,
      cwd,
      name: s.name,
      created: s.created instanceof Date ? s.created.toISOString() : String(s.created),
      modified: s.modified instanceof Date ? s.modified.toISOString() : String(s.modified),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage || "(no messages)",
      parentSessionId: s.parentSessionPath ? pathToId.get(s.parentSessionPath) : undefined,
      worktree: cwd ? worktreeByCwd.get(cwd) : undefined,
      git: cwd ? gitByCwd.get(cwd) : undefined,
    };
  });
}

// ============================================================================
// Session path cache: sessionId → absolute file path
// Stored in globalThis for hot-reload safety
// ============================================================================
declare global {
  var __piSessionPathCache: Map<string, string> | undefined;
}

function getPathCache(): Map<string, string> {
  if (!globalThis.__piSessionPathCache) globalThis.__piSessionPathCache = new Map();
  return globalThis.__piSessionPathCache;
}

export async function resolveSessionPath(sessionId: string): Promise<string | null> {
  const cached = getPathCache().get(sessionId);
  if (cached) return cached;

  // Cache miss: scan all sessions to populate cache, then retry
  await listAllSessions();
  return getPathCache().get(sessionId) ?? null;
}

export function cacheSessionPath(sessionId: string, filePath: string): void {
  getPathCache().set(sessionId, filePath);
}

export function invalidateSessionPathCache(sessionId: string): void {
  getPathCache().delete(sessionId);
}

export function getSessionEntries(filePath: string): SessionEntry[] {
  const entries = SessionManager.open(filePath).getEntries();
  return entries as unknown as SessionEntry[];
}

export function buildTree(entries: SessionEntry[]): SessionTreeNode[] {
  const nodeMap = new Map<string, SessionTreeNode>();
  const labelsById = new Map<string, string>();

  for (const entry of entries) {
    if (entry.type === "label") {
      const l = entry as { type: "label"; targetId: string; label?: string };
      if (l.label) labelsById.set(l.targetId, l.label);
      else labelsById.delete(l.targetId);
    }
  }

  const roots: SessionTreeNode[] = [];
  for (const entry of entries) {
    nodeMap.set(entry.id, { entry, children: [], label: labelsById.get(entry.id) });
  }
  for (const entry of entries) {
    const node = nodeMap.get(entry.id)!;
    if (!entry.parentId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(entry.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop()!;
    node.children.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
    stack.push(...node.children);
  }
  return roots;
}

export function buildSessionContext(entries: SessionEntry[], leafId?: string | null): SessionContext {
  const byId = new Map<string, SessionEntry>();
  for (const e of entries) byId.set(e.id, e);

  const piEntries = entries as unknown as PiSessionEntry[];
  const piCtx = piBuildSessionContext(piEntries, leafId, byId as unknown as Map<string, PiSessionEntry>);

  // Build entryIds: parallel array to messages[], mapping each message back to its entry id.
  // Needed for fork and navigate_tree calls from the UI.
  let targetLeaf: SessionEntry | undefined;
  if (leafId === null) {
    return { messages: [], entryIds: [], thinkingLevel: piCtx.thinkingLevel, model: piCtx.model };
  }
  if (leafId) targetLeaf = byId.get(leafId);
  if (!targetLeaf) targetLeaf = entries[entries.length - 1];
  if (!targetLeaf) {
    return { messages: [], entryIds: [], thinkingLevel: piCtx.thinkingLevel, model: piCtx.model };
  }

  // Walk path from target leaf to root
  const path: SessionEntry[] = [];
  let cur: SessionEntry | undefined = targetLeaf;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }

  // Find the last compaction on path (mirrors pi's buildSessionContext logic)
  let compactionId: string | undefined;
  let firstKeptEntryId: string | undefined;
  for (const e of path) {
    if (e.type === "compaction") {
      compactionId = e.id;
      firstKeptEntryId = (e as { firstKeptEntryId: string }).firstKeptEntryId;
    }
  }

  const entryIds: string[] = [];
  if (compactionId) {
    // The first message in piCtx.messages is the synthetic compaction summary — map to compaction entry id
    entryIds.push(compactionId);
    const compactionIdx = path.findIndex((e) => e.id === compactionId);
    const firstKeptIdx = firstKeptEntryId
      ? path.findIndex((e, i) => i < compactionIdx && e.id === firstKeptEntryId)
      : -1;
    const startIdx = firstKeptIdx >= 0 ? firstKeptIdx : compactionIdx;
    for (let i = startIdx; i < compactionIdx; i++) {
      if (path[i].type === "message") entryIds.push(path[i].id);
    }
    for (let i = compactionIdx + 1; i < path.length; i++) {
      if (path[i].type === "message") entryIds.push(path[i].id);
    }
  } else {
    for (const e of path) {
      if (e.type === "message") entryIds.push(e.id);
    }
  }

  // pi injects compaction summary as {role:"compactionSummary", summary, tokensBefore}.
  // Convert to {role:"user"} so MessageView can render it the same as before.
  const messages = (piCtx.messages as AssistantMessage[]).map((msg) => {
    const raw = msg as unknown as Record<string, unknown>;
    if (raw.role === "compactionSummary") {
      return {
        role: "user" as const,
        content: `*The conversation history before this point was compacted into the following summary:*\n\n${raw.summary ?? ""}`,
        timestamp: raw.timestamp as number | undefined,
      };
    }
    return normalizeToolCalls(msg);
  });

  return {
    messages,
    entryIds,
    thinkingLevel: piCtx.thinkingLevel,
    model: piCtx.model,
  };
}

export function getLeafId(entries: SessionEntry[]): string | null {
  if (entries.length === 0) return null;
  return entries[entries.length - 1].id;
}




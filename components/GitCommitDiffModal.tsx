"use client";

import { useCallback, useEffect, useState } from "react";
import type { GitCommitChangedFile, GitCommitFileDiffResponse } from "@/lib/types";
import { UnifiedDiffView } from "./UnifiedDiffView";

interface Props {
  cwd: string;
  hash: string;
  shortHash?: string;
  file: GitCommitChangedFile;
  onClose: () => void;
}

function statusLabel(status: GitCommitChangedFile["status"]): string {
  switch (status) {
    case "A": return "Added";
    case "D": return "Deleted";
    case "R": return "Renamed";
    case "C": return "Copied";
    case "T": return "Type changed";
    case "U": return "Unmerged";
    case "M": return "Modified";
    default: return "Changed";
  }
}

function reasonLabel(reason: GitCommitFileDiffResponse["reason"]): string {
  switch (reason) {
    case "binary": return "Binary file changes cannot be rendered as text.";
    case "too-large": return "This diff is too large to render safely in the browser.";
    case "unavailable":
    default:
      return "No text diff is available for this file in the selected commit.";
  }
}

export function GitCommitDiffModal({ cwd, hash, shortHash, file, onClose }: Props) {
  const [data, setData] = useState<GitCommitFileDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cwd, hash, path: file.file });
      if (file.oldFile) params.set("oldPath", file.oldFile);
      const res = await fetch(`/api/git/diff?${params.toString()}`);
      const body = await res.json() as GitCommitFileDiffResponse | { error?: string };
      if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      setData(body as GitCommitFileDiffResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cwd, file.file, file.oldFile, hash]);

  useEffect(() => {
    void loadDiff();
  }, [loadDiff]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const displayPath = file.oldFile ? `${file.oldFile} → ${file.file}` : file.file;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Diff for ${file.file}`}
      style={{
        position: "fixed",
        inset: 16,
        zIndex: 1000,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "rgba(0,0,0,0.42)",
        borderRadius: 14,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(1440px, 100%)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--bg-panel)",
          color: "var(--text)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>
                {shortHash ?? hash.slice(0, 8)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayPath}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{statusLabel(file.status)}</span>
              {typeof file.additions === "number" && <span style={{ color: "#16a34a" }}>+{file.additions}</span>}
              {typeof file.deletions === "number" && <span style={{ color: "#dc2626" }}>-{file.deletions}</span>}
              {file.binary && <span>binary</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diff"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--bg)" }}>
          {loading ? (
            <div style={{ padding: 18, color: "var(--text-muted)", fontSize: 13 }}>Loading diff...</div>
          ) : error ? (
            <div style={{ padding: 18, color: "#dc2626", fontSize: 13 }}>{error}</div>
          ) : data?.diffAvailable && data.diff ? (
            <UnifiedDiffView diff={data.diff} />
          ) : (
            <div style={{ padding: 18, color: "var(--text-muted)", fontSize: 13 }}>
              {reasonLabel(data?.reason)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

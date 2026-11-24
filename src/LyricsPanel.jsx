import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLyrics, parseSyncedLyrics } from "./lyrics.js";

export default function LyricsPanel({ track, position }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState({ status: "idle", record: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const listRef = useRef(null);
  const activeLineRef = useRef(null);
  const syncedLines = useMemo(() => parseSyncedLyrics(result.record?.syncedLyrics), [result.record]);
  const plainLines = useMemo(() => String(result.record?.plainLyrics || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean), [result.record]);
  const activeIndex = useMemo(() => {
    if (!syncedLines.length) return -1;
    let low = 0;
    let high = syncedLines.length - 1;
    let active = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (syncedLines[middle].time <= position) {
        active = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return active;
  }, [position, syncedLines]);

  useEffect(() => {
    if (!open || !track?.id) return undefined;
    const controller = new AbortController();
    setResult({ status: "loading", record: null, error: "" });
    fetchLyrics(track, controller.signal).then((record) => {
      if (!controller.signal.aborted) setResult({ status: record ? "ready" : "empty", record, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted && error.name !== "AbortError") {
        setResult({ status: "error", record: null, error: error.message || "Lyrics could not be loaded right now." });
      }
    });
    return () => controller.abort();
  }, [open, track?.id, attempt]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current || !activeLineRef.current) return;
    const list = listRef.current;
    const line = activeLineRef.current;
    const nextTop = line.offsetTop - list.offsetTop - list.clientHeight / 2 + line.clientHeight / 2;
    list.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  }, [activeIndex, open]);

  return (
    <section className="lyrics-feature" aria-label="Song lyrics">
      <button
        className={"lyrics-toggle" + (open ? " on" : "")}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span>Lyrics</span>
        <span className="lyrics-toggle-state" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="lyrics-panel" aria-live="polite">
          {result.status === "loading" && <p className="lyrics-message">Finding lyrics…</p>}
          {result.status === "error" && (
            <div className="lyrics-message">
              <p>{result.error}</p>
              <button className="lyrics-retry" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </div>
          )}
          {result.status === "empty" && <p className="lyrics-message">Lyrics aren’t available for this song yet.</p>}
          {result.status === "ready" && result.record?.instrumental && !syncedLines.length && !plainLines.length && (
            <p className="lyrics-message">This track is marked as instrumental.</p>
          )}
          {result.status === "ready" && syncedLines.length > 0 && (
            <div className="lyrics-lines synced" ref={listRef} aria-label="Synchronized lyrics">
              {syncedLines.map((line, index) => (
                <p
                  key={`${line.time}-${index}`}
                  ref={index === activeIndex ? activeLineRef : null}
                  className={index === activeIndex ? "active" : ""}
                >{line.text}</p>
              ))}
            </div>
          )}
          {result.status === "ready" && !syncedLines.length && plainLines.length > 0 && (
            <div className="lyrics-lines plain" aria-label="Lyrics">
              {plainLines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
              <small>These lyrics don’t have playback timing.</small>
            </div>
          )}
          {result.status === "ready" && !result.record?.instrumental && !syncedLines.length && !plainLines.length && (
            <p className="lyrics-message">Lyrics aren’t available for this song yet.</p>
          )}
          {result.status === "ready" && result.record && <small className="lyrics-credit">Lyrics provided by LRCLIB</small>}
        </div>
      )}
    </section>
  );
}

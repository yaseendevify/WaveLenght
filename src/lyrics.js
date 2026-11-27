const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function parseSyncedLyrics(value) {
  if (!value) return [];
  const lines = [];
  let offset = 0;
  for (const rawLine of value.split(/\r?\n/)) {
    const offsetMatch = rawLine.match(/^\[offset:([+-]?\d+)\]/i);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]) / 1000;
      continue;
    }
    const stamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = rawLine.replace(/\[[^\]]+\]/g, "").trim();
    if (!text || !stamps.length) continue;
    for (const stamp of stamps) {
      const fraction = (stamp[3] || "0").padEnd(3, "0").slice(0, 3);
      const time = Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number(fraction) / 1000 + offset);
      lines.push({ time, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

const hasLyrics = (record) => Boolean(record?.syncedLyrics?.trim() || record?.plainLyrics?.trim() || record?.instrumental);

async function requestLyrics(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { "Lrclib-Client": "Wavelength/1.0 (https://github.com/yaseendevify/WaveLenght)" },
  });
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error("Lyrics are temporarily busy. Try again in a moment.");
  if (!response.ok) throw new Error("Lyrics could not be loaded right now.");
  return response.json();
}

export async function fetchLyrics(track, signal) {
  const title = String(track?.title || "").trim();
  const artist = String(track?.artist || "").trim();
  if (!title || !artist) return null;

  const exactUrl = new URL("https://lrclib.net/api/get");
  exactUrl.searchParams.set("track_name", title);
  exactUrl.searchParams.set("artist_name", artist);
  if (track.album) exactUrl.searchParams.set("album_name", track.album);
  const duration = Math.round(Number(track.dur) || 0);
  if (duration >= 1 && duration <= 3600) exactUrl.searchParams.set("duration", String(duration));

  const exact = await requestLyrics(exactUrl, signal);
  if (hasLyrics(exact)) return exact;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 300);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
  const searchUrl = new URL("https://lrclib.net/api/search");
  searchUrl.searchParams.set("track_name", title);
  searchUrl.searchParams.set("artist_name", artist);
  const results = await requestLyrics(searchUrl, signal);
  if (!Array.isArray(results)) return null;

  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);
  const candidates = results.filter(hasLyrics).map((record) => {
    const foundTitle = normalize(record.trackName || record.name);
    const foundArtist = normalize(record.artistName);
    let score = foundTitle === wantedTitle ? 3 : foundTitle.includes(wantedTitle) || wantedTitle.includes(foundTitle) ? 1 : -4;
    if (foundArtist === wantedArtist) score += 3;
    else if (foundArtist && wantedArtist && (foundArtist.includes(wantedArtist) || wantedArtist.includes(foundArtist))) score += 1;
    if (duration && Math.abs(Number(record.duration) - duration) <= 2) score += 2;
    return { record, score };
  }).filter(({ score }) => score >= 4).sort((a, b) => b.score - a.score);
  return candidates[0]?.record || null;
}

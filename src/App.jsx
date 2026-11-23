import { useEffect, useRef, useState } from "react";
import { GL, T, art } from "./data.js";
import * as E from "./engine.js";
import { putFile, getFile, delFile, allFiles } from "./store.js";
import * as fb from "./firebase.js";

const bg = (t) =>
  t.img
    ? { background: `url(${t.img}) center/cover` }
    : { background: art(t).replace("background:", "") };
GL.jamendo = "Jamendo";
GL.audius = "Audius";
GL.saavn = "JioSaavn";
GL.gaana = "Gaana";
const JKEY = import.meta.env.VITE_JAMENDO_CLIENT_ID;
const TAGS = [
  "lofi",
  "electronic",
  "ambient",
  "pop",
  "rock",
  "jazz",
  "hiphop",
  "classical",
];
const DESI = {
  hindi: { lang: "hi" },
  urdu: { lang: "ur" },
  punjabi: { lang: "pa" },
  indian: { tags: "indian" },
  bollywood: { tags: "bollywood" },
  sufi: { tags: "sufi" },
  pakistani: { tags: "pakistani" },
  pakistan: { tags: "pakistan" },
  pashto: { tags: "pashto" },
  sindhi: { tags: "sindhi" },
  saraiki: { tags: "saraiki" },
  "coke studio pakistan": { tags: "coke studio pakistan" },
};
const tagP = (g) => DESI[g] || { tags: g };
const jamSearch = async (p) => {
  const u = new URL("https://api.jamendo.com/v3.0/tracks/");
  Object.entries({ client_id: JKEY, format: "json", limit: 30, ...p }).forEach(
    ([k, v]) => u.searchParams.set(k, v),
  );
  const j = await (await fetch(u)).json();
  if (j.headers && j.headers.status !== "success")
    throw new Error(j.headers.error_message || "Jamendo error");
  return (j.results || [])
    .filter((x) => x.audio || x.audiodownload)
    .map((x) => {
      const id = "j" + x.id;
      T[id] = T[id] || {
        id,
        title: x.name,
        artist: x.artist_name,
        g: "jamendo",
        url: x.audio || x.audiodownload,
        dur: +x.duration || 0,
        img: x.image,
        artistImg: x.artist_image || x.artistImage || "",
        hue: +x.id % 360,
      };
      return id;
    });
};
const AUD = "https://api.audius.co/v1";
const audGet = async (path, p = {}) => {
  const u = new URL(AUD + path);
  u.searchParams.set("app_name", "Wavelength");
  Object.entries(p).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (!r.ok) throw new Error("Audius error " + r.status);
  const j = await r.json();
  return (j.data || [])
    .filter(
      (x) =>
        x &&
        x.is_streamable !== false &&
        !(x.access && x.access.stream === false),
    )
    .map((x) => {
      const id = "a" + x.id;
      T[id] = T[id] || {
        id,
        title: x.title,
        artist: (x.user && x.user.name) || "Unknown",
        g: "audius",
        url: AUD + "/tracks/" + x.id + "/stream?app_name=Wavelength",
        dur: +x.duration || 0,
        img:
          x.artwork &&
          (x.artwork["480x480"] ||
            x.artwork["150x150"] ||
            x.artwork["1000x1000"]),
        artistImg:
          x.user?.profile_picture?.["480x480"] ||
          x.user?.profile_picture?.["150x150"] ||
          "",
        hue: [...String(x.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
      };
      return id;
    });
};
const audSearch = (q) => audGet("/tracks/search", { query: q, limit: 30 });
const SAAVN = "https://saavn.bycomsolutions.com";
const saavnImage = (images) =>
  [...(Array.isArray(images) ? images : [])].sort(
    (a, b) => parseInt(b.quality || "0", 10) - parseInt(a.quality || "0", 10),
  )[0]?.url || "";
const mapSaavnSong = (x) => {
  const id = "s" + x.id;
  const audio = Array.isArray(x.downloadUrl) ? x.downloadUrl : [];
  const bestAudio = [...audio].sort(
    (a, b) => parseInt(b.quality || "0", 10) - parseInt(a.quality || "0", 10),
  )[0]?.url;
  const bestImage = saavnImage(x.image);
  const artist =
    x.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ") ||
    x.artists?.all?.map((a) => a.name).filter(Boolean).join(", ") ||
    x.album?.name ||
    "Unknown artist";
  T[id] = {
    ...(T[id] || {}),
    id,
    title: x.name || x.title || "Unknown title",
    artist,
    g: "saavn",
    url: bestAudio || T[id]?.url || "",
    dur: Number(x.duration) || T[id]?.dur || 0,
    img: bestImage || T[id]?.img || "",
    artistImg: bestImage || T[id]?.artistImg || "",
    hue: [...String(x.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
    album: x.album?.name || x.album || T[id]?.album || "",
    sourceUrl: x.url || T[id]?.sourceUrl || "",
  };
  return id;
};
const saavnRequest = async (path, params = {}) => {
  const u = new URL(SAAVN + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (!r.ok) throw new Error("JioSaavn request failed (" + r.status + ")");
  const j = await r.json();
  if (j.success === false) throw new Error(j.message || "JioSaavn request failed");
  return j.data ?? j;
};
const saavnList = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const candidate =
    data.results || data.songs || data.topSongs ||
    data.data?.results || data.data?.songs || data.data || [];
  if (Array.isArray(candidate)) return candidate;
  return candidate && candidate !== data ? saavnList(candidate) : [];
};
const saavnSearchSongs = async (query, page = 0) => {
  const data = await saavnRequest("/api/search/songs", { query, page, limit: 20 });
  return saavnList(data).map(mapSaavnSong);
};
const saavnSearchArtists = async (query) => {
  const data = await saavnRequest("/api/search/artists", { query, page: 0, limit: 16 });
  return saavnList(data).map((x) => ({
    id: String(x.id),
    name: x.name || x.title || "Unknown artist",
    role: x.role || "Artist",
    img: saavnImage(x.image),
    url: x.url || "",
  }));
};
const saavnSearchAlbums = async (query) => {
  const data = await saavnRequest("/api/search/albums", { query, page: 0, limit: 16 });
  return saavnList(data).map((x) => ({
    id: String(x.id),
    name: x.name || x.title || "Untitled album",
    artist:
      x.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ") ||
      x.artists?.all?.map((a) => a.name).filter(Boolean).join(", ") ||
      x.artist ||
      "Various artists",
    img: saavnImage(x.image),
    year: x.year || "",
    language: x.language || "",
    url: x.url || "",
  }));
};
const GAANA = "https://shnwazdev-gaana-api.vercel.app";
const gaanaSearchSongs = async (query) => {
  const u = new URL(GAANA + "/api/search");
  u.searchParams.set("q", query);
  u.searchParams.set("type", "song");
  u.searchParams.set("limit", "30");
  const r = await fetch(u);
  if (!r.ok) throw new Error("Gaana search failed (" + r.status + ")");
  const j = await r.json();
  if (j.status === false || j.success === false)
    throw new Error(j.message || "Gaana search failed");
  const list = Array.isArray(j)
    ? j
    : j.results || j.data?.results || j.data || j.songs || [];
  return list
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const key =
        x.seokey ||
        x.seo_key ||
        x.slug ||
        (x.gaana_url || x.url || "").split("/").filter(Boolean).pop();
      const id =
        "g" +
        (x.id || key || encodeURIComponent(x.title || x.name || Math.random()));
      const title = x.title || x.name || x.track_title || "Unknown title";
      const artist =
        x.artist ||
        x.artist_name ||
        x.singer ||
        x.primary_artist ||
        "Unknown artist";
      const direct = x.link || x.stream_url || x.audio_url || x.audio || "";
      T[id] = T[id] || {
        id,
        title,
        artist,
        g: "gaana",
        url: direct,
        dur:
          Number(x.duration_seconds) ||
          (Number.isFinite(Number(x.duration)) ? Number(x.duration) : 0),
        img: x.thumb || x.image || x.artwork || x.album_art || "",
        artistImg: x.artist_image || x.artistImage || x.artist_img || "",
        hue: [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
        album: x.album || x.album_title || "",
        seokey: key,
        sourceUrl: x.gaana_url || x.url || "",
      };
      return id;
    });
};
const resolveGaanaStream = async (track) => {
  if (track.url) return track;
  if (!track.seokey) return track;
  const u = new URL(GAANA + "/api/stream");
  u.searchParams.set("seokey", track.seokey);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Gaana stream lookup failed (" + r.status + ")");
  const j = await r.json();
  const url = j.link || j.stream || j.stream_url || j.audio_url || j.hls_url;
  if (url) track.url = url;
  return track;
};
const perArtist = (ids, n) => {
  const c = {};
  return ids.filter((id) => {
    const a = ((T[id] && T[id].artist) || id).toLowerCase().trim();
    c[a] = (c[a] || 0) + 1;
    return c[a] <= n;
  });
};
const loadShelves = (jobs) =>
  Promise.all(
    jobs.map((j) =>
      j
        .f()
        .then((ids) => ({ t: j.t, ids: perArtist(ids, 1).slice(0, 14) }))
        .catch((e) => ({ t: j.t, ids: [], e: String(e.message || e) })),
    ),
  );
const homeSearch = async (query, artistMatch) => {
  const results = await Promise.allSettled([
    saavnSearchSongs(query),
    gaanaSearchSongs(query),
    audSearch(query),
  ]);
  const ids = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  return artistMatch
    ? ids.filter((id) =>
        (T[id]?.artist || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes(artistMatch),
      )
    : ids;
};
const homeJobs = () => [
  {
    t: "Pakistani Music",
    f: () => homeSearch("Pakistani songs"),
  },
  {
    t: "Arijit Singh",
    f: () => homeSearch("Arijit Singh songs", "arijit"),
  },
  {
    t: "KK",
    f: () => homeSearch("KK singer songs", "kk"),
  },
  ...(JKEY
    ? [
        {
          t: "Trending on Jamendo",
          f: () => jamSearch({ order: "popularity_week", limit: 40 }),
        },
      ]
    : []),
  {
    t: "Trending on Audius",
    f: () => audGet("/tracks/trending", { time: "week", limit: 40 }),
  },
  {
    t: "Coke Studio Pakistan on Audius",
    f: () => audSearch("Coke Studio Pakistan"),
  },
  ...(JKEY
    ? [
        ["Hindi", "hindi"],
        ["Urdu", "urdu"],
        ["Punjabi", "punjabi"],
      ].map(([n, g]) => ({
        t: n + " on Jamendo",
        f: () => jamSearch({ order: "popularity_week", ...tagP(g), limit: 40 }),
      }))
    : []),
];
const SORTS = {
  recents: "Recents",
  added: "Recently Added",
  alpha: "Alphabetical",
};
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
const spParse = (x) => {
  x = x.trim();
  const m =
    x.match(
      /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/,
    ) ||
    x.match(
      /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)/,
    );
  return m ? { k: m[1], id: m[2] } : null;
};
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const blobs = new Map();
const getBlob = async (id) => {
  if (blobs.has(id)) return blobs.get(id);
  const r = await getFile(id);
  if (!r || !r.blob) throw 0;
  blobs.set(id, r.blob);
  return r.blob;
};
const KEYS = [
  "liked",
  "recents",
  "sp",
  "yt",
  "jam",
  "fx",
  "lv",
  "ls",
  "rp",
  "sc",
  "sw",
  "hist",
  "vol",
  "shuf",
  "rep",
  "playlists",
  "savedAlbums",
  "followedArtists",
];
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("wl2") || "{}");
  } catch {
    return {};
  }
};

function Auth({ onGuest }) {
  const [em, setEm] = useState(""),
    [pw, setPw] = useState(""),
    [err, setErr] = useState("");
  const run = async (f) => {
    setErr("");
    try {
      await f();
    } catch (e) {
      setErr(
        String(e.code || e.message)
          .replace("auth/", "")
          .replace(/-/g, " "),
      );
    }
  };
  return (
    <div className="auth">
      <div className="logo">
        Wave<span>length</span>
      </div>
      {fb.configured ? (
        <>
          <input
            type="email"
            placeholder="Email"
            value={em}
            onChange={(e) => setEm(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button className="pri" onClick={() => run(() => fb.signIn(em, pw))}>
            Log in
          </button>
          <button className="pill" onClick={() => run(() => fb.signUp(em, pw))}>
            Create account
          </button>
          <button className="pill" onClick={() => run(fb.google)}>
            Continue with Google
          </button>
          {err && <div className="err">{err}</div>}
        </>
      ) : (
        <div className="empty">
          Firebase isn’t configured yet. See the README, or continue without an
          account.
        </div>
      )}
      <button className="addm" onClick={onGuest}>
        Continue without an account
      </button>
    </div>
  );
}

function Row({ id, i, list, c }) {
  const t = T[id],
    on = c.cur && c.cur.id === id;
  return (
    <div
      className={"row" + (on ? " on" + (c.playing ? " pl" : "") : "")}
      onClick={() => c.play(list, id)}
    >
      <span className="n">
        <em>{i + 1}</em>
        <span className="eq">
          <i />
          <i />
          <i />
        </span>
      </span>
      <div className="tt">
        <div className="cv" style={bg(t)} />
        <div style={{ minWidth: 0 }}>
          <b>{t.title}</b>
          <small>{t.artist}</small>
        </div>
      </div>
      <span className="al">{GL[t.g]}</span>
      <button
        className={"lk" + (c.liked.has(id) ? " on" : "")}
        onClick={(e) => {
          e.stopPropagation();
          c.like(id);
        }}
      >
        ♥
      </button>
      <span className="du">{fmt(t.dur)}</span>
      <button
        className="ib"
        data-q="1"
        title="Add to queue"
        aria-label={"Add " + t.title + " to queue"}
        onClick={(e) => {
          e.stopPropagation();
          c.addQ(id);
        }}
      >
        ＋
      </button>
      <button
        className="ib playlist-add"
        title="Add to playlist"
        aria-label={"Add " + t.title + " to playlist"}
        onClick={(e) => {
          e.stopPropagation();
          c.addToPlaylist(id);
        }}
      >
        ☷
      </button>
    </div>
  );
}

function SharedPlaylistView({ state }) {
  const playlist = state.playlist;
  const tracks = playlist?.tracks || [];
  const duration = tracks.reduce((total, track) => total + (Number(track.dur) || 0), 0);
  return (
    <main className="shared-playlist-page">
      <div className="shared-playlist-shell">
        <a className="shared-playlist-brand" href={window.location.pathname}>Wavelength</a>
        {state.status === "loading" ? (
          <div className="shared-playlist-message">Loading playlist…</div>
        ) : !playlist ? (
          <div className="shared-playlist-message">
            <h1>Playlist unavailable</h1>
            <p>This playlist is private or its sharing link has been turned off.</p>
          </div>
        ) : (
          <article className="shared-playlist-card">
            <header className="shared-playlist-hero">
              {playlist.cover ? <img src={playlist.cover} alt="" /> : <div className="shared-playlist-placeholder">♫</div>}
              <div>
                <small>PUBLIC PLAYLIST · READ ONLY</small>
                <h1>{playlist.name}</h1>
                {playlist.description && <p>{playlist.description}</p>}
                <span>{tracks.length} songs · {Math.round(duration / 60)} min</span>
              </div>
            </header>
            {playlist.localTrackCount > 0 && (
              <p className="shared-playlist-note">{playlist.localTrackCount} device-only {playlist.localTrackCount === 1 ? "song is" : "songs are"} not included.</p>
            )}
            <ol className="shared-playlist-tracks">
              {tracks.length ? tracks.map((track, index) => (
                <li key={track.id || index}>
                  <span className="shared-track-index">{index + 1}</span>
                  {track.img ? <img src={track.img} alt="" loading="lazy" /> : <span className="shared-track-art">♫</span>}
                  <span className="shared-track-copy"><b>{track.title || "Untitled song"}</b><small>{track.artist || "Unknown artist"}{track.album ? ` · ${track.album}` : ""}</small></span>
                  <time>{track.dur ? `${Math.floor(track.dur / 60)}:${String(Math.floor(track.dur % 60)).padStart(2, "0")}` : ""}</time>
                </li>
              )) : <li className="shared-playlist-empty">This playlist has no shareable songs yet.</li>}
            </ol>
          </article>
        )}
      </div>
    </main>
  );
}

const sharedPlaylistData = (playlist, ownerId) => {
  const trackData = new Map((playlist.trackData || []).map((track) => [track.id, track]));
  const sourceTracks = (playlist.tracks || [])
    .map((id) => trackData.get(id) || T[id])
    .filter(Boolean);
  const shareableTracks = sourceTracks.filter((track) => !track.file && track.g !== "local");
  if (shareableTracks.length > 500) throw new Error("A shared playlist can contain up to 500 songs");
  const text = (value, limit) => String(value || "").slice(0, limit);
  return {
    ownerId,
    isPublic: true,
    name: text(playlist.name, 70),
    description: text(playlist.description, 240),
    cover: text(playlist.cover, 600),
    localTrackCount: sourceTracks.length - shareableTracks.length,
    tracks: shareableTracks.map((track) => ({
      id: text(track.id, 180),
      title: text(track.title, 160),
      artist: text(track.artist, 160),
      album: text(track.album, 160),
      img: text(track.img, 600),
      g: text(track.g, 24),
      dur: Math.max(0, Number(track.dur) || 0),
    })),
    updatedAt: Date.now(),
  };
};

export default function App() {
  const [user, setUser] = useState(undefined),
    [guest, setGuest] = useState(false),
    [ready, setReady] = useState(false);
  const [sharedId] = useState(() => new URLSearchParams(window.location.search).get("sharedPlaylist") || "");
  const [sharedView, setSharedView] = useState({ status: "loading", playlist: null });
  const [d, setD] = useState(readLocal),
    [local, setLocal] = useState([]);
  const [v, setV] = useState({ n: "home" }),
    [sq, setSq] = useState(""),
    [spIn, setSpIn] = useState(""),
    [npOpen, setNpOpen] = useState(false),
    [queueOpen, setQueueOpen] = useState(false),
    [lq, setLq] = useState(""),
    [lsOpen, setLsOpen] = useState(false),
    [sortOpen, setSortOpen] = useState(false),
    [acctOpen, setAcctOpen] = useState(false),
    [hm, setHm] = useState({ shelves: [], loaded: false }),
    [playlistPicker, setPlaylistPicker] = useState(null),
    [playlistForm, setPlaylistForm] = useState(null);
  const [cur, setCur] = useState(null),
    [playing, setPlaying] = useState(false),
    [q, setQ] = useState({ ids: [], i: 0 });
  const [pos, setPos] = useState(0),
    [dur, setDur] = useState(0),
    [msg, setMsg] = useState("");
  const R = useRef({}),
    fi = useRef(),
    mainRef = useRef(),
    drag = useRef(false),
    tm = useRef(),
    sv = useRef(),
    endedHandled = useRef(false);
  const liked = new Set(d.liked || []),
    rep = d.rep || "off",
    shuf = !!d.shuf,
    vol = d.vol ?? 0.8,
    sp = d.sp || [],
    playlists = d.playlists || [],
    savedAlbums = d.savedAlbums || [],
    followedArtists = d.followedArtists || [];
  (d.jam || []).forEach((j) => {
    if (!T[j.id])
      T[j.id] = {
        ...j,
        g:
          String(j.id)[0] === "a"
            ? "audius"
            : String(j.id)[0] === "s"
              ? "saavn"
              : String(j.id)[0] === "g"
                ? "gaana"
                : "jamendo",
      };
  });
  (d.hist || []).forEach((h) => {
    if (h.url && !T[h.id])
      T[h.id] = {
        ...h,
        g:
          String(h.id)[0] === "a"
            ? "audius"
            : String(h.id)[0] === "s"
              ? "saavn"
              : String(h.id)[0] === "g"
                ? "gaana"
                : "jamendo",
      };
  });
  (d.playlists || []).forEach((playlist) => {
    (playlist.trackData || []).forEach((track) => {
      if (track?.id && !T[track.id]) T[track.id] = { ...track };
    });
  });
  const [dc, setDc] = useState({ shelves: [], busy: false, err: "" }),
    [dq, setDq] = useState(""),
    [dtag, setDtag] = useState(""),
    [sr, setSr] = useState({
      ids: [],
      aids: [],
      saavn: [],
      gaana: [],
      artists: [],
      albums: [],
      busy: false,
      err: "",
    }),
    [searchFilter, setSearchFilter] = useState("all"),
    [detail, setDetail] = useState({ busy: false, err: "", artist: null, album: null, songs: [], albums: [] }),
    [bq, setBq] = useState(""),
    [br, setBr] = useState({ ids: [], busy: false, err: "" }),
    [pq, setPq] = useState(""),
    [pr, setPr] = useState({ ids: [], busy: false, err: "" });
  const tl = (m) => {
    setMsg(m);
    clearTimeout(tm.current);
    tm.current = setTimeout(() => setMsg(""), 1800);
  };
  const nav = (n, id) => {
    setV({ n, id });
    if (n === "pl" && id)
      setD((x) => ({
        ...x,
        rp: [id, ...(x.rp || []).filter((y) => y !== id)].slice(0, 20),
      }));
  };
  const allIds = () =>
    Object.keys(T).filter((id) => !T[id].url || liked.has(id));
  const idsOf = (k) => {
    if (k === "liked") return [...liked].filter((x) => T[x]);
    if (k === "local") return local;
    return playlists.find((playlist) => playlist.id === k)?.tracks?.filter((id) => T[id]) || [];
  };
  const meta = (k) => {
    if (k === "liked") return { name: "Liked Songs", desc: "Songs you’ve hearted", hue: 280 };
    if (k === "local") return { name: "Your music", desc: "Files from your device", hue: 160 };
    const playlist = playlists.find((item) => item.id === k);
    return playlist ? {
      name: playlist.name,
      desc: playlist.description || "Playlist",
      hue: 185,
      img: playlist.cover || "",
    } : null;
  };
  const savePlaylist = async () => {
    const name = (playlistForm?.name || "").trim();
    if (!name) return tl("Give your playlist a name first");
    const previous = playlistForm.mode === "edit"
      ? playlists.find((item) => item.id === playlistForm.id)
      : null;
    if (playlistForm.isPublic && !user) return tl("Sign in to publish a playlist");
    if (previous?.isPublic && !playlistForm.isPublic && !user) return tl("Sign in to change playlist sharing");
    let item;
    if (playlistForm.mode === "edit") {
      item = {
        ...previous,
        name,
        description: (playlistForm.description || "").trim(),
        cover: (playlistForm.cover || "").trim(),
        isPublic: !!playlistForm.isPublic,
        updatedAt: Date.now(),
      };
    } else {
      const id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const track = playlistPicker ? T[playlistPicker] : null;
      item = {
        id, name, description: playlistForm.description.trim(),
        cover: playlistForm.cover.trim(), isPublic: !!playlistForm.isPublic,
        tracks: track ? [track.id] : [],
        trackData: track ? [{
          id: track.id, title: track.title, artist: track.artist, g: track.g,
          url: track.url || "", dur: track.dur || 0, img: track.img || "",
          artistImg: track.artistImg || "", hue: track.hue || 0, album: track.album || "",
        }] : [],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
    }
    try {
      if (item.isPublic) {
        item.shareId = item.shareId || fb.newSharedPlaylistId();
        await fb.saveSharedPlaylist(item.shareId, sharedPlaylistData(item, user.uid));
      } else if (previous?.isPublic && previous.shareId) {
        await fb.deleteSharedPlaylist(previous.shareId);
      }
    } catch (error) {
      return tl(error.message?.includes("500 songs") ? error.message : "Could not update playlist sharing");
    }
    if (playlistForm.mode === "edit") {
      setD((x) => ({
        ...x,
        playlists: (x.playlists || []).map((current) => current.id === item.id ? item : current),
      }));
      tl(item.isPublic ? "Playlist updated · public link ready" : "Playlist updated");
    } else {
      setD((x) => ({ ...x, playlists: [item, ...(x.playlists || [])] }));
      setPlaylistPicker(null);
      nav("pl", item.id);
      tl(item.tracks.length ? "Playlist created and song added" : "Playlist created");
    }
    setPlaylistForm(null);
  };
  const deletePlaylist = async (id) => {
    const item = playlists.find((p) => p.id === id);
    if (!item || !confirm('Delete "' + item.name + '"? This cannot be undone.')) return;
    if (item.isPublic && !user) return tl("Sign in to delete a public playlist");
    if (item.isPublic && item.shareId) {
      try { await fb.deleteSharedPlaylist(item.shareId); }
      catch { return tl("Could not turn off the public link"); }
    }
    setD((x) => ({ ...x, playlists: (x.playlists || []).filter((p) => p.id !== id) }));
    nav("lib");
    tl("Playlist deleted");
  };
  const copyPlaylistLink = async (playlist) => {
    if (!playlist?.isPublic || !playlist.shareId) return;
    const link = new URL(window.location.pathname, window.location.origin);
    link.searchParams.set("sharedPlaylist", playlist.shareId);
    try {
      await navigator.clipboard.writeText(link.toString());
      tl("Public playlist link copied");
    } catch {
      try {
        const field = document.createElement("textarea");
        field.value = link.toString();
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        tl(copied ? "Public playlist link copied" : "Could not copy the playlist link");
      } catch {
        tl("Could not copy the playlist link");
      }
    }
  };
  const addToPlaylist = (id) => {
    if (!playlists.length) {
      setPlaylistPicker(id);
      setPlaylistForm({ mode: "create", name: "", description: "", cover: "", isPublic: false });
      return;
    }
    setPlaylistPicker(id);
  };
  const choosePlaylist = (playlistId) => {
    if (playlists.find((item) => item.id === playlistId)?.isPublic && !user) {
      return tl("Sign in to update a public playlist");
    }
    const track = T[playlistPicker];
    if (!track) return setPlaylistPicker(null);
    setD((x) => ({
      ...x,
      playlists: (x.playlists || []).map((item) => {
        if (item.id !== playlistId) return item;
        if ((item.tracks || []).includes(track.id)) return item;
        const trackData = [...(item.trackData || []).filter((t) => t.id !== track.id), {
          id: track.id, title: track.title, artist: track.artist, g: track.g,
          url: track.url || "", dur: track.dur || 0, img: track.img || "",
          artistImg: track.artistImg || "", hue: track.hue || 0, album: track.album || "",
        }];
        return { ...item, tracks: [...(item.tracks || []), track.id], trackData, updatedAt: Date.now() };
      }),
    }));
    setPlaylistPicker(null);
    tl("Added to playlist");
  };
  const removePlaylistTrack = (playlistId, trackId) => {
    if (playlists.find((item) => item.id === playlistId)?.isPublic && !user) return tl("Sign in to update a public playlist");
    setD((x) => ({
      ...x,
      playlists: (x.playlists || []).map((item) => item.id === playlistId
        ? { ...item, tracks: (item.tracks || []).filter((id) => id !== trackId), trackData: (item.trackData || []).filter((track) => track.id !== trackId), updatedAt: Date.now() }
        : item),
    }));
  };
  const movePlaylistTrack = (playlistId, index, direction) => {
    if (playlists.find((item) => item.id === playlistId)?.isPublic && !user) return tl("Sign in to update a public playlist");
    setD((x) => ({
      ...x,
      playlists: (x.playlists || []).map((item) => {
        if (item.id !== playlistId) return item;
        const tracks = [...(item.tracks || [])], next = index + direction;
        if (next < 0 || next >= tracks.length) return item;
        [tracks[index], tracks[next]] = [tracks[next], tracks[index]];
        return { ...item, tracks, updatedAt: Date.now() };
      }),
    }));
  };
  const toggleAlbumSave = (album) => {
    const entry = {
      id: String(album.id), name: album.name || album.title || "Album",
      artist: album.artist || album.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ") || "Various artists",
      img: album.img || saavnImage(album.image) || album.image?.[0]?.url || "",
      year: album.year || "", language: album.language || "",
    };
    setD((x) => ({
      ...x,
      savedAlbums: (x.savedAlbums || []).some((item) => item.id === entry.id)
        ? x.savedAlbums.filter((item) => item.id !== entry.id)
        : [entry, ...(x.savedAlbums || [])],
    }));
  };
  const toggleArtistFollow = (artist) => {
    const entry = {
      id: String(artist.id), name: artist.name || artist.title || "Artist",
      role: artist.role || "Artist",
      img: artist.img || saavnImage(artist.image) || artist.image?.[0]?.url || "",
    };
    setD((x) => ({
      ...x,
      followedArtists: (x.followedArtists || []).some((item) => item.id === entry.id)
        ? x.followedArtists.filter((item) => item.id !== entry.id)
        : [entry, ...(x.followedArtists || [])],
    }));
  };

  /* player */
  const go = async (id, nq, auto = true) => {
    let t = T[id];
    if (t && t.g === "gaana" && !t.url) {
      try {
        t = await resolveGaanaStream(t);
        T[id] = t;
      } catch (e) {
        tl(String(e.message || e));
      }
    }
    setCur(t);
    setQ(nq);
    setPlaying(auto);
    setPos(0);
    setD((x) => ({
      ...x,
      recents: [id, ...(x.recents || []).filter((r) => r !== id)].slice(0, 12),
    }));
    if (auto)
      setD((x) => {
        const e = {
          id,
          ts: Date.now(),
          ...(t.url
            ? {
                title: t.title,
                artist: t.artist,
                url: t.url,
                dur: t.dur,
                img: t.img,
                hue: t.hue,
              }
            : {}),
        };
        return {
          ...x,
          hist: [
            e,
            ...(x.hist || []).filter((y, i) => !(i === 0 && y.id === id)),
          ].slice(0, 100),
        };
      });
    if (!t.url && !t.file) {
      setPlaying(false);
      tl("Audio stream is not available for this song");
      return;
    }
    const ok = await E.play(t, 0, getBlob);
    if (ok) endedHandled.current = false;
    if (ok === false) {
      tl("Could not play this file");
      return;
    }
    if (ok && !auto) E.pause();
  };
  const play = (ids, id) =>
    go(
      id,
      shuf
        ? { ids: [id, ...shuffle(ids.filter((x) => x !== id))], i: 0 }
        : { ids: [...ids], i: ids.indexOf(id) },
    );
  const seekTo = async (s) => {
    const c = R.current.cur;
    if (!c) return;
    await E.play(c, s, getBlob);
    if (!R.current.playing) E.pause();
  };
  const next = (auto) => {
    const { q, rep, cur } = R.current;
    if (!q.ids.length) return;
    if (auto && rep === "one") return go(cur.id, q);
    let i = q.i + 1;
    if (i >= q.ids.length) {
      if (rep === "all" || !auto) i = 0;
      else {
        setPlaying(false);
        E.pause();
        setPos(E.dur());
        return;
      }
    }
    go(q.ids[i], { ...q, i });
  };
  const prev = () => {
    const { q, rep, cur } = R.current;
    if (!cur) return;
    if (E.pos() > 3) return seekTo(0);
    const i = q.i > 0 ? q.i - 1 : rep === "all" ? q.ids.length - 1 : 0;
    go(q.ids[i], { ...q, i });
  };
  const toggle = () => {
    const { cur, playing } = R.current;
    if (!cur) {
      const a = allIds();
      return play(a, a[0]);
    }
    if (playing) {
      E.pause();
      setPlaying(false);
    } else if (E.ended()) {
      go(cur.id, q);
    } else {
      E.resume();
      setPlaying(true);
    }
  };
  const like = (id) => {
    const t = T[id];
    setD((x) => {
      const s = new Set(x.liked || []),
        on = s.has(id);
      on ? s.delete(id) : s.add(id);
      const jam = (x.jam || []).filter((j) => j.id !== id);
      if (
        !on &&
        t &&
        (t.g === "jamendo" || t.g === "audius" || t.g === "saavn")
      )
        jam.push({
          id,
          title: t.title,
          artist: t.artist,
          url: t.url,
          dur: t.dur,
          img: t.img,
          hue: t.hue,
        });
      return { ...x, liked: [...s], jam };
    });
    tl(liked.has(id) ? "Removed from Liked Songs" : "Added to Liked Songs");
  };
  const toggleShuf = () => {
    setD((x) => ({ ...x, shuf: !x.shuf }));
    if (!shuf && cur)
      setQ({
        ids: [cur.id, ...shuffle(q.ids.filter((x) => x !== cur.id))],
        i: 0,
      });
  };
  const cycleRep = () =>
    setD((x) => ({
      ...x,
      rep: (x.rep || "off") === "off" ? "all" : x.rep === "all" ? "one" : "off",
    }));
  const addQ = (id) => {
    if (!cur) return play([id], id);
    setQ((x) => ({ ...x, ids: [...x.ids, id] }));
    tl("Added to queue");
  };
  const moveQ = (from, to) => {
    setQ((x) => {
      if (from <= x.i || to <= x.i || from >= x.ids.length || to >= x.ids.length) return x;
      const ids = [...x.ids];
      const [item] = ids.splice(from, 1);
      ids.splice(to, 0, item);
      return { ...x, ids };
    });
  };
  const removeQ = (index) => {
    setQ((x) => {
      if (index <= x.i || index >= x.ids.length) return x;
      return { ...x, ids: x.ids.filter((_, i) => i !== index) };
    });
    tl("Removed from queue");
  };
  const clearQ = () => {
    setQ({ ids: cur ? [cur.id] : [], i: 0 });
    tl("Queue cleared");
  };
  const playQueueItem = (index) => {
    const id = q.ids[index];
    if (!id || !T[id]) return;
    go(id, { ...q, i: index });
    setQueueOpen(false);
  };
  R.current = { q, rep, cur, playing, next, toggle, prev, like, toggleShuf };
  const c = { cur, playing, liked, play, like, addQ, addToPlaylist };

  /* local files */
  const addFiles = async (e) => {
    const fs = [...e.target.files];
    e.target.value = "";
    let n = 0;
    for (const f of fs) {
      tl("Adding " + f.name.slice(0, 28) + "…");
      try {
        const dur = await E.decodeDur(f),
          id = "f" + Date.now().toString(36) + n,
          hue = [...f.name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360,
          title = f.name.replace(/\.[^.]+$/, "");
        await putFile({ id, title, dur, hue, blob: f });
        blobs.set(id, f);
        T[id] = {
          id,
          title,
          artist: "Your device",
          g: "local",
          file: true,
          dur,
          hue,
        };
        setLocal((l) => [...l, id]);
        n++;
      } catch {
        tl("Can’t read " + f.name.slice(0, 28));
      }
    }
    if (n) {
      tl(n + " song" + (n > 1 ? "s" : "") + " added");
      nav("pl", "local");
    }
  };
  const removeAll = () => {
    if (!confirm("Remove all your uploaded songs from this browser?")) return;
    if (cur && cur.file) {
      E.stopAll();
      setCur(null);
      setPlaying(false);
    }
    local.forEach((id) => {
      delete T[id];
      blobs.delete(id);
      delFile(id);
    });
    setLocal([]);
    nav("home");
  };

  /* effects */
  useEffect(() => {
    E.setVol(vol);
    const un = fb.onUser(setUser);
    allFiles().then((rs) => {
      if (!Array.isArray(rs)) return;
      rs.sort((a, b) => (a.id < b.id ? -1 : 1));
      rs.forEach((r) => {
        blobs.set(r.id, r.blob);
        T[r.id] = {
          id: r.id,
          title: r.title,
          artist: "Your device",
          g: "local",
          file: true,
          dur: r.dur,
          hue: r.hue,
        };
      });
      setLocal(rs.map((r) => r.id));
    });
    return un;
  }, []);
  useEffect(() => {
    if (!sharedId) return;
    let active = true;
    fb.loadSharedPlaylist(sharedId)
      .then((playlist) => active && setSharedView({ status: "ready", playlist }))
      .catch(() => active && setSharedView({ status: "ready", playlist: null }));
    return () => { active = false; };
  }, [sharedId]);
  useEffect(() => {
    if (!user) {
      setReady(false);
      return;
    }
    setReady(false);
    fb.loadData(user.uid)
      .then((r) => r && setD((x) => ({ ...x, ...r })))
      .catch(() => tl("Could not load your account data"))
      .finally(() => setReady(true));
  }, [user]);
  useEffect(() => {
    if (!user || !ready) return;
    const published = (d.playlists || []).filter((playlist) => playlist.isPublic && playlist.shareId);
    if (!published.length) return;
    const timer = setTimeout(() => {
      Promise.resolve().then(() => Promise.all(published.map((playlist) => fb.saveSharedPlaylist(
        playlist.shareId,
        sharedPlaylistData(playlist, user.uid),
      )))).catch(() => tl("Could not update the public playlist link"));
    }, 700);
    return () => clearTimeout(timer);
  }, [d.playlists, user, ready]);
  useEffect(() => {
    try {
      localStorage.setItem("wl2", JSON.stringify(d));
    } catch {}
    if (user && ready) {
      clearTimeout(sv.current);
      sv.current = setTimeout(
        () =>
          fb
            .saveData(
              user.uid,
              Object.fromEntries(
                KEYS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]),
              ),
            )
            .catch(() => tl("Could not sync")),
        800,
      );
    }
  }, [d, user, ready]);
  useEffect(() => {
    const h = setInterval(() => {
      const r = R.current;
      if (!r.cur) return;
      if (!drag.current) setPos(E.pos());
      setDur(E.dur());
      if (r.playing && E.ended() && !endedHandled.current) {
        endedHandled.current = true;
        r.next(true);
      }
    }, 250);
    return () => clearInterval(h);
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "range")
        return;
      const r = R.current,
        k = e.key.toLowerCase();
      if (e.key === " ") {
        e.preventDefault();
        r.toggle();
      } else if (k === "n") r.next(false);
      else if (k === "b") r.prev();
      else if (k === "l" && r.cur) r.like(r.cur.id);
      else if (k === "s") r.toggleShuf();
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [v]);
  useEffect(() => {
    if (v.n !== "disc") return;
    let dead = false;
    setDc((x) => ({ ...x, busy: true, err: "" }));
    const h = setTimeout(
      () => {
        const q = dq.trim();
        const J = (t, p) => (JKEY ? [{ t, f: () => jamSearch(p) }] : []);
        const A = (t, f) => [{ t, f }];
        const jobs = q
          ? [...J("Jamendo", { search: q }), ...A("Audius", () => audSearch(q))]
          : dtag
            ? [
                ...J(dtag, { order: "popularity_week", ...tagP(dtag) }),
                ...A(dtag + " · Audius", () => audSearch(dtag)),
              ]
            : [
                ...J("Trending this week", {
                  order: "popularity_week",
                  limit: 40,
                }),
                ...A("Trending on Audius", () =>
                  audGet("/tracks/trending", { time: "week", limit: 40 }),
                ),
                ...[
                  "hindi",
                  "urdu",
                  "punjabi",
                  "indian",
                  "lofi",
                  "electronic",
                  "pop",
                ].flatMap((g) =>
                  J(g, { order: "popularity_week", ...tagP(g), limit: 40 }),
                ),
                ...[
                  "Pakistani music",
                  "Coke Studio Pakistan",
                  "Pashto music",
                  "Sindhi music",
                  "Saraiki music",
                ].map((query) => ({
                  t: query + " · Audius",
                  f: () => audSearch(query),
                })),
              ];
        Promise.all(
          jobs.map((j) =>
            j
              .f()
              .then((ids) => ({
                t: j.t,
                ids: q
                  ? ids
                  : dtag
                    ? perArtist(ids, 2)
                    : perArtist(ids, 1).slice(0, 14),
              }))
              .catch((e) => ({ t: j.t, ids: [], e: String(e.message || e) })),
          ),
        ).then(
          (sh) =>
            !dead &&
            setDc({
              shelves: sh,
              busy: false,
              err: sh.every((x) => !x.ids.length)
                ? (sh.find((x) => x.e) || {}).e ||
                  (q ? "" : "No tracks came back. Check the Network tab.")
                : "",
            }),
        );
      },
      dq ? 400 : 0,
    );
    return () => {
      dead = true;
      clearTimeout(h);
    };
  }, [v.n, dq, dtag]);

  useEffect(() => {
    if (v.n !== "search") return;
    const q = sq.trim();
    if (!q) {
      setSr({ ids: [], aids: [], saavn: [], gaana: [], artists: [], albums: [], busy: false, err: "" });
      return;
    }
    let dead = false;
    setSr((x) => ({ ...x, busy: true, err: "" }));
    const h = setTimeout(
      () =>
        Promise.allSettled([
          JKEY ? jamSearch({ search: q }) : Promise.resolve([]),
          audSearch(q),
          saavnSearchSongs(q),
          gaanaSearchSongs(q),
          saavnSearchArtists(q),
          saavnSearchAlbums(q),
        ]).then(([a, b, c, d, e, f]) => {
          if (dead) return;
          setSr({
            ids: a.status === "fulfilled" ? a.value : [],
            aids: b.status === "fulfilled" ? b.value : [],
            saavn: c.status === "fulfilled" ? c.value : [],
            gaana: d.status === "fulfilled" ? d.value : [],
            artists: e.status === "fulfilled" ? e.value : [],
            albums: f.status === "fulfilled" ? f.value : [],
            busy: false,
            err: [a, b, c, d, e, f].every((x) => x.status === "rejected")
              ? String((c.reason && c.reason.message) || c.reason)
              : "",
          });
        }),
      400,
    );
    return () => {
      dead = true;
      clearTimeout(h);
    };
  }, [v.n, sq]);

  useEffect(() => {
    if (v.n !== "artist" && v.n !== "album") return;
    let dead = false;
    setDetail({ busy: true, err: "", artist: null, album: null, songs: [], albums: [] });
    const id = v.id;
    if (v.n === "artist") {
      Promise.allSettled([
        saavnRequest("/api/artists/" + encodeURIComponent(id)),
        saavnRequest("/api/artists/" + encodeURIComponent(id) + "/songs", { page: 0, sort: 1 }),
        saavnRequest("/api/artists/" + encodeURIComponent(id) + "/albums", { page: 0, sort: 1 }),
      ]).then(([artistResult, songsResult, albumsResult]) => {
        if (dead) return;
        const artistData = artistResult.status === "fulfilled" ? artistResult.value : null;
        const artistPayload = artistData?.artist || artistData?.data?.artist || artistData;
        const artist = Array.isArray(artistPayload) ? artistPayload[0] : artistPayload;
        const songData = songsResult.status === "fulfilled" ? songsResult.value : [];
        const albumData = albumsResult.status === "fulfilled" ? albumsResult.value : [];
        const songs = saavnList(songData).map(mapSaavnSong);
        const albums = saavnList(albumData).map((x) => ({
          id: String(x.id),
          name: x.name || x.title || "Untitled album",
          artist: artist?.name || artist?.title || "Artist",
          img: saavnImage(x.image),
          year: x.year || "",
          language: x.language || "",
          url: x.url || "",
        }));
        setDetail({
          busy: false,
          err: artistResult.status === "rejected" && songsResult.status === "rejected"
            ? String(artistResult.reason?.message || "Could not load this artist.")
            : "",
          artist: artist || { id, name: "Artist" },
          album: null,
          songs,
          albums,
        });
      });
    } else {
      saavnRequest("/api/albums", { id }).then((data) => {
        if (dead) return;
        const albumPayload = data?.album || data?.data?.album || data;
        const album = Array.isArray(albumPayload) ? albumPayload[0] : albumPayload;
        const songs = saavnList(album?.songs || album?.tracks || data?.songs || []).map(mapSaavnSong);
        setDetail({
          busy: false,
          err: "",
          artist: null,
          album: album || { id, name: "Album" },
          songs,
          albums: [],
        });
      }).catch((error) => {
        if (!dead) setDetail({ busy: false, err: String(error.message || error), artist: null, album: null, songs: [], albums: [] });
      });
    }
    return () => { dead = true; };
  }, [v.n, v.id]);

  useEffect(() => {
    if (v.n !== "bollywood") return;
    const query = bq.trim() || "Bollywood";
    let dead = false;
    setBr((x) => ({ ...x, busy: true, err: "" }));
    const h = setTimeout(
      () => {
        Promise.allSettled([
          saavnSearchSongs(query),
          gaanaSearchSongs(query),
        ]).then(([saavn, gaana]) => {
          if (dead) return;
          const ids = [
            ...(saavn.status === "fulfilled" ? saavn.value : []),
            ...(gaana.status === "fulfilled" ? gaana.value : []),
          ];
          const seen = new Set();
          const unique = ids.filter((id) => {
            const t = T[id];
            const key = (t.title + "|" + t.artist)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, " ")
              .trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setBr({
            ids: unique,
            busy: false,
            err: unique.length
              ? ""
              : String(
                  (saavn.reason || gaana.reason || {}).message ||
                    "No results from music sources",
                ),
          });
        });
      },
      bq.trim() ? 350 : 0,
    );
    return () => {
      dead = true;
      clearTimeout(h);
    };
  }, [v.n, bq]);

  useEffect(() => {
    if (v.n !== "pakistani") return;
    const query = pq.trim() || "Pakistani music";
    let dead = false;
    setPr((x) => ({ ...x, busy: true, err: "" }));
    const h = setTimeout(() => {
      Promise.allSettled([
        saavnSearchSongs(query),
        gaanaSearchSongs(query),
        audSearch(query),
      ]).then(([saavn, gaana, audius]) => {
        if (dead) return;
        const ids = [
          ...(saavn.status === "fulfilled" ? saavn.value : []),
          ...(gaana.status === "fulfilled" ? gaana.value : []),
          ...(audius.status === "fulfilled" ? audius.value : []),
        ];
        const seen = new Set();
        const unique = ids.filter((id) => {
          const t = T[id];
          const key = (t.title + "|" + t.artist)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const failures = [saavn, gaana, audius].filter((x) => x.status === "rejected");
        setPr({
          ids: unique,
          busy: false,
          err: unique.length
            ? ""
            : String(
                failures[0]?.reason?.message ||
                  "No results from Pakistani music sources. Try another search.",
              ),
        });
      });
    }, pq.trim() ? 350 : 0);
    return () => {
      dead = true;
      clearTimeout(h);
    };
  }, [v.n, pq]);

  const ty = useRef({ y: 0, top: 0 }),
    pv = useRef({ n: "home" });
  useEffect(() => {
    if (sharedId || v.n !== "home" || hm.loaded) return;
    let dead = false;
    loadShelves(homeJobs()).then(
      (sh) => !dead && setHm({ shelves: sh, loaded: true }),
    );
    return () => {
      dead = true;
    };
  }, [v.n, sharedId]);
  useEffect(() => {
    E.setFx(
      d.fx || { bass: 0, pre: 0, bands: [0, 0, 0, 0, 0], spatial: false },
    );
  }, [d.fx]);

  if (sharedId) return <SharedPlaylistView state={sharedView} />;
  if (user === undefined) return null;
  if (!user && !guest) return <Auth onGuest={() => setGuest(true)} />;

  /* views */
  const rows = (ids, key) =>
    ids.length ? (
      ids.map((id, i) => <Row key={key + id} id={id} i={i} list={ids} c={c} />)
    ) : (
      <div className="empty">Nothing here yet.</div>
    );
  const Card = ({ k }) => {
    const p = meta(k);
    return (
      <div className="card" onClick={() => nav("pl", k)}>
        <div className="cardart" style={bg(p)}>
          <button
            className="pb"
            onClick={(e) => {
              e.stopPropagation();
              const ids = idsOf(k);
              if (ids.length) play(ids, ids[0]);
            }}
          >
            ▶
          </button>
        </div>
        <b>{p.name}</b>
        <small>{p.desc}</small>
      </div>
    );
  };
  const Li = ({ k }) => {
    const p = meta(k);
    if (!p) return null;
    return (
      <div className="li" title={p.name} onClick={() => nav("pl", k)}>
        <div className="a" style={bg(p)} />
        <div>
          <b>{p.name}</b>
          <small>Collection • {idsOf(k).length} songs</small>
        </div>
      </div>
    );
  };
  const plKeys = ["liked", ...playlists.map((item) => item.id), ...(local.length ? ["local"] : [])];
  const acct = user ? (
    <button
      className="addm"
      onClick={() => {
        E.stopAll();
        setCur(null);
        setPlaying(false);
        fb.logout();
      }}
    >
      Log out ·{" "}
      {user.displayName || (user.email || "").split("@")[0] || "account"}
    </button>
  ) : (
    <button className="addm" onClick={() => fb.configured && setGuest(false)}>
      {fb.configured ? "Log in / sign up" : "Guest mode"}
    </button>
  );
  const h = new Date().getHours(),
    greet =
      h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const fxPanel = () => {
    const PRE = {
      flat: { bass: 0, bands: [0, 0, 0, 0, 0] },
      bass: { bass: 8, bands: [3, 2, 0, 0, 0] },
      bassmax: { bass: 14, bands: [5, 3, 0, -1, 0] },
      treble: { bass: 0, bands: [0, 0, 0, 3, 6] },
      vocal: { bass: 0, bands: [-2, -1, 3, 4, 1] },
      electronic: { bass: 5, bands: [4, 2, -1, 2, 4] },
      pop: { bass: 0, bands: [-1, 2, 4, 2, -1] },
      rock: { bass: 2, bands: [4, 2, -2, 2, 5] },
      hiphop: { bass: 8, bands: [5, 3, 0, 1, 2] },
    };
    const NM = {
      flat: "Flat",
      bass: "Bass Boost",
      bassmax: "Bass Boost+",
      treble: "Treble",
      vocal: "Vocal",
      electronic: "Electronic",
      pop: "Pop",
      rock: "Rock",
      hiphop: "Hip-hop",
    };
    const f = {
      bass: 0,
      pre: 0,
      bands: [0, 0, 0, 0, 0],
      spatial: false,
      preset: "flat",
      ...(d.fx || {}),
    };
    const setF = (p) => setD((z) => ({ ...z, fx: { ...f, ...p } }));
    const sl = (label, min, max, val, on) => (
      <label className="fxr" key={label}>
        <span>{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step="1"
          value={val}
          style={{ "--p": ((val - min) / (max - min)) * 100 + "%" }}
          onChange={(e) => on(+e.target.value)}
        />
        <em>
          {val > 0 ? "+" : ""}
          {val} dB
        </em>
      </label>
    );
    const labels = ["60 Hz", "230 Hz", "910 Hz", "3.6 kHz", "14 kHz"];
    return (
      <>
        <div className="chips">
          {Object.keys(PRE).map((k) => (
            <button
              key={k}
              className={"chip" + (f.preset === k ? " on" : "")}
              onClick={() => setF({ ...PRE[k], pre: 0, preset: k })}
            >
              {NM[k]}
            </button>
          ))}
        </div>
        {sl("Bass boost", 0, 15, f.bass, (x) =>
          setF({ bass: x, preset: "custom" }),
        )}
        {sl("Volume boost", -6, 6, f.pre, (x) =>
          setF({ pre: x, preset: "custom" }),
        )}
        <h2>5-band equalizer</h2>
        {labels.map((l, i) =>
          sl(l, -12, 12, f.bands[i], (x) =>
            setF({
              bands: f.bands.map((b, j) => (j === i ? x : b)),
              preset: "custom",
            }),
          ),
        )}
        <div className="act">
          <button
            className={"chip" + (f.spatial ? " on" : "")}
            onClick={() => setF({ spatial: !f.spatial })}
          >
            8D audio {f.spatial ? "on" : "off"}
          </button>
          <button
            className="pill"
            onClick={() =>
              setF({ ...PRE.flat, pre: 0, spatial: false, preset: "flat" })
            }
          >
            Reset
          </button>
        </div>
        <div className="empty">
          {cur
            ? E.fxOn()
              ? "Effects are active on the current song."
              : "This song’s source blocks audio processing, so effects can’t be applied to it."
            : "Play a song to hear the effects."}{" "}
          They don’t work on the Spotify player.
        </div>
      </>
    );
  };
  const tc = (id, list) => {
    const t = T[id],
      on = cur && cur.id === id;
    return (
      <div
        key={id}
        className={"card" + (on ? " on" : "")}
        onClick={() => play(list, id)}
      >
        <div className="cardart" style={bg(t)}>
          <button
            className="pb"
            style={on ? { opacity: 1, transform: "none" } : null}
            onClick={(e) => {
              e.stopPropagation();
              on ? toggle() : play(list, id);
            }}
          >
            {on && playing ? "❚❚" : "▶"}
          </button>
        </div>
        <b>{t.title}</b>
        <small>{t.artist}</small>
      </div>
    );
  };
  const scrollShelf = (event, direction) => {
    const shelf = event.currentTarget
      .closest(".shelf-wrap")
      ?.querySelector(".shelf, .artist-shelf");
    if (!shelf) return;
    shelf.scrollBy({ left: direction * shelf.clientWidth * 0.8, behavior: "smooth" });
  };
  const artistPicks = (() => {
    const seen = new Set();
    return hm.shelves.flatMap((shelf) => shelf.ids).filter((id) => {
      const track = T[id];
      const artist = (track?.artist || "").trim();
      const key = artist.toLowerCase();
      if (!artist || key === "unknown" || key === "unknown artist" || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18).map((id) => ({ id, artist: T[id].artist }));
  })();
  const ls = d.ls || "recents",
    lv = d.lv || "list",
    rpl = d.rp || [],
    uname = user
      ? user.displayName || (user.email || "").split("@")[0] || "account"
      : "";
  let libKeys = plKeys.filter((k) =>
    meta(k).name.toLowerCase().includes(lq.trim().toLowerCase()),
  );
  if (ls === "alpha")
    libKeys = [...libKeys].sort((a, b) =>
      meta(a).name.localeCompare(meta(b).name),
    );
  else if (ls === "added") libKeys = [...libKeys].reverse();
  else
    libKeys = [...libKeys].sort((a, b) => {
      const x = rpl.indexOf(a),
        y = rpl.indexOf(b);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    });
  let main;
  if (v.n === "home")
    main = (
      <>
        <h2>{greet}</h2>
        <div className="quick">
          {plKeys.slice(0, 8).map((k) => {
            const p = meta(k);
            return (
              <div key={k} className="qt" onClick={() => nav("pl", k)}>
                <div className="a" style={bg(p)} />
                <span>{p.name}</span>
              </div>
            );
          })}
        </div>
        {artistPicks.length > 0 && (
          <section className="artist-section">
            <div className="hhead">
              <h2>Popular artists</h2>
              <span className="artist-note">Discover your next favourite</span>
            </div>
            <div className="shelf-wrap artist-wrap">
              <button
                type="button"
                className="shelf-arrow shelf-arrow-left"
                aria-label="Scroll artists left"
                title="Scroll left"
                onClick={(event) => scrollShelf(event, -1)}
              >
                ‹
              </button>
              <div className="artist-shelf">
              {artistPicks.map(({ id, artist }) => {
                const track = T[id];
                return (
                  <button
                    type="button"
                    className="artist-card"
                    key={artist.toLowerCase()}
                    onClick={() => play([id], id)}
                    title={"Play a track by " + artist}
                  >
                    <span
                      className="artist-art"
                      style={bg({ ...track, img: track.artistImg || track.img })}
                    >
                      <span className="artist-play">▶</span>
                    </span>
                    <b>{artist}</b>
                    <small>Artist</small>
                  </button>
                );
              })}
              </div>
              <button
                type="button"
                className="shelf-arrow shelf-arrow-right"
                aria-label="Scroll artists right"
                title="Scroll right"
                onClick={(event) => scrollShelf(event, 1)}
              >
                ›
              </button>
            </div>
          </section>
        )}
        {hm.shelves
          .filter((x) => x.ids.length)
          .map((sh) => (
            <div key={sh.t}>
              <div className="hhead shelf-heading">
                <h2>{sh.t}</h2>
              </div>
              <div className="shelf-wrap">
                <button
                  type="button"
                  className="shelf-arrow shelf-arrow-left"
                  aria-label={"Scroll " + sh.t + " left"}
                  title="Scroll left"
                  onClick={(event) => scrollShelf(event, -1)}
                >
                  ‹
                </button>
                <div className="shelf">{sh.ids.map((id) => tc(id, sh.ids))}</div>
                <button
                  type="button"
                  className="shelf-arrow shelf-arrow-right"
                  aria-label={"Scroll " + sh.t + " right"}
                  title="Scroll right"
                  onClick={(event) => scrollShelf(event, 1)}
                >
                  ›
                </button>
              </div>
            </div>
          ))}
        <h2>Your library</h2>
        <div className="shelf">
          {plKeys.map((k) => (
            <Card key={k} k={k} />
          ))}
        </div>
        {(d.recents || []).filter((x) => T[x]).length > 0 && (
          <>
            <h2>Recently played</h2>
            {rows((d.recents || []).filter((x) => T[x]).slice(0, 6), "r")}
          </>
        )}
        <h2>All songs</h2>
        {rows(allIds(), "a")}
      </>
    );
  else if (v.n === "search") {
    const s = sq.trim().toLowerCase();
    const jset = new Set([
      ...sr.ids, ...sr.aids, ...(sr.saavn || []), ...(sr.gaana || []),
    ]);
    const res = s ? allIds().filter((id) =>
      !jset.has(id) &&
      (T[id].title + " " + T[id].artist + " " + GL[T[id].g]).toLowerCase().includes(s),
    ) : [];
    const cats = [
      ...new Map([
        ...Object.keys(GL).filter((k) => k !== "local" && k !== "jamendo" && k !== "audius").map((k) => GL[k]),
        ...Object.keys(DESI), ...TAGS,
      ].map((n) => [n.toLowerCase(), n])).values(),
    ];
    const filters = [
      ["all", "All"], ["songs", "Songs"], ["artists", "Artists"], ["albums", "Albums"],
    ];
    const artistCards = (items) => (
      <div className="entity-grid artist-results">
        {items.map((artist) => {
          const followed = followedArtists.some((item) => item.id === String(artist.id));
          return <div className="entity-card artist-result" key={artist.id}>
            <button className="entity-open" onClick={() => nav("artist", artist.id)}>
              {artist.img ? <img src={artist.img} alt="" loading="lazy" /> : <span className="entity-placeholder">♪</span>}
              <b>{artist.name}</b><small>{artist.role || "Artist"}</small>
            </button>
            <button className="entity-save" onClick={() => toggleArtistFollow(artist)}>{followed ? "Following" : "＋ Follow"}</button>
          </div>;
        })}
      </div>
    );
    const albumCards = (items) => (
      <div className="entity-grid album-results">
        {items.map((album) => {
          const saved = savedAlbums.some((item) => item.id === String(album.id));
          return <div className="entity-card album-result" key={album.id}>
            <button className="entity-open" onClick={() => nav("album", album.id)}>
              {album.img ? <img src={album.img} alt="" loading="lazy" /> : <span className="entity-placeholder">♫</span>}
              <b>{album.name}</b><small>{album.artist}{album.year ? " · " + album.year : ""}</small>
            </button>
            <button className="entity-save" onClick={() => toggleAlbumSave(album)}>{saved ? "Saved" : "＋ Save album"}</button>
          </div>;
        })}
      </div>
    );
    const showSongs = searchFilter === "all" || searchFilter === "songs";
    const showArtists = searchFilter === "all" || searchFilter === "artists";
    const showAlbums = searchFilter === "all" || searchFilter === "albums";
    main = (
      <>
        {s ? (
          <>
            <div className="search-filters" role="tablist" aria-label="Search categories">
              {filters.map(([key, label]) => (
                <button key={key} className={"search-filter" + (searchFilter === key ? " active" : "")}
                  role="tab" aria-selected={searchFilter === key} onClick={() => setSearchFilter(key)}>{label}</button>
              ))}
            </div>
            {sr.busy && !sr.saavn.length && !sr.artists.length && !sr.albums.length && <div className="empty">Searching WaveLenght…</div>}
            {showArtists && <>
              <div className="hhead"><h2>Artists</h2></div>
              {sr.artists.length ? artistCards(sr.artists) : <div className="empty">{sr.busy ? "Finding artists…" : "No artists found."}</div>}
            </>}
            {showAlbums && <>
              <div className="hhead"><h2>Albums</h2></div>
              {sr.albums.length ? albumCards(sr.albums) : <div className="empty">{sr.busy ? "Finding albums…" : "No albums found."}</div>}
            </>}
            {showSongs && <>
              <div className="hhead"><h2>Songs · JioSaavn</h2></div>
              {sr.saavn.length ? rows(sr.saavn, "saavn-search-") : <div className="empty">{sr.busy ? "Searching JioSaavn…" : "No JioSaavn songs found."}</div>}
              <div className="hhead"><h2>Songs · Gaana</h2></div>
              {sr.gaana.length ? rows(sr.gaana, "gaana-search-") : <div className="empty">{sr.busy ? "Searching Gaana…" : "No Gaana results."}</div>}
              {JKEY && <>
                <div className="hhead"><h2>Songs · Jamendo</h2></div>
                {sr.ids.length ? rows(sr.ids, "j") : <div className="empty">{sr.busy ? "Searching Jamendo…" : "No Jamendo results."}</div>}
              </>}
              <div className="hhead"><h2>Songs · Audius</h2></div>
              {sr.aids.length ? rows(sr.aids, "au") : <div className="empty">{sr.busy ? "Searching Audius…" : "No Audius results."}</div>}
              {res.length > 0 && <><div className="hhead"><h2>In your library</h2></div>{rows(res, "s")}</>}
            </>}
          </>
        ) : (
          <>
            <h2>Browse all</h2>
            <div className="cats">{cats.map((n, i) => (
              <div key={n} className="cat cap" style={{ background: `hsl(${i * 47 + 20} 60% 40%)` }} onClick={() => setSq(n)}>{n}</div>
            ))}</div>
          </>
        )}
      </>
    );
  } else if (v.n === "artist") {
    const artist = detail.artist || {};
    const artistName = artist.name || artist.title || "Artist";
    const artistImage = saavnImage(artist.image) || artist.image?.[0]?.url || "";
    main = (
      <>
        <button className="detail-back" onClick={() => nav("search")}>← Back to search</button>
        <section className="detail-hero artist-hero">
          {artistImage ? <img src={artistImage} alt="" /> : <div className="entity-placeholder">♪</div>}
          <div><small>ARTIST</small><h1>{artistName}</h1>
            <p>{artist.role || "Artist"}{artist.followerCount ? " · " + Number(artist.followerCount).toLocaleString() + " followers" : ""}</p>
            <button className="pill detail-save" onClick={() => toggleArtistFollow({ id: v.id, name: artistName, role: artist.role, img: artistImage })}>
              {followedArtists.some((item) => item.id === String(v.id)) ? "Following ✓" : "＋ Follow artist"}
            </button>
          </div>
        </section>
        {detail.busy ? <div className="empty">Loading artist…</div> : detail.err ? <div className="err">{detail.err}</div> : <>
          <div className="hhead"><h2>Popular songs</h2></div>
          {rows(detail.songs, "artist-" + v.id)}
          {detail.albums.length > 0 && <><div className="hhead"><h2>Albums</h2></div><div className="entity-grid album-results">
            {detail.albums.map((album) => <button className="entity-card album-result" key={album.id} onClick={() => nav("album", album.id)}>
              {album.img ? <img src={album.img} alt="" loading="lazy" /> : <span className="entity-placeholder">♫</span>}
              <b>{album.name}</b><small>{album.year || album.language || "Album"}</small>
            </button>)}
          </div></>}
        </>}
      </>
    );
  } else if (v.n === "album") {
    const album = detail.album || {};
    const albumName = album.name || album.title || "Album";
    const albumImage = saavnImage(album.image) || album.image?.[0]?.url || "";
    const albumArtist = album.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ") || album.artist || "Various artists";
    main = (
      <>
        <button className="detail-back" onClick={() => nav("search")}>← Back to search</button>
        <section className="detail-hero album-hero">
          {albumImage ? <img src={albumImage} alt="" /> : <div className="entity-placeholder">♫</div>}
          <div><small>ALBUM</small><h1>{albumName}</h1><p>{albumArtist}{album.year ? " · " + album.year : ""}{album.language ? " · " + album.language : ""}</p>
            <div className="detail-actions">
              <button className="pri detail-play" disabled={!detail.songs.length} onClick={() => play(detail.songs, detail.songs[0])}>▶ Play album</button>
              <button className="pill detail-save" onClick={() => toggleAlbumSave({ id: v.id, name: albumName, artist: albumArtist, img: albumImage, year: album.year, language: album.language })}>
                {savedAlbums.some((item) => item.id === String(v.id)) ? "Saved ✓" : "＋ Save album"}
              </button>
            </div>
          </div>
        </section>
        {detail.busy ? <div className="empty">Loading album…</div> : detail.err ? <div className="err">{detail.err}</div> : rows(detail.songs, "album-" + v.id)}
      </>
    );
  } else if (v.n === "bollywood") {
    main = (
      <>
        <div className="hhead">
          <div>
            <h2>Bollywood</h2>
            <div className="empty" style={{ padding: "0 0 12px" }}>
              Explore Hindi film music across JioSaavn and Gaana catalogs.
            </div>
          </div>
        </div>
        <div className="sbox">
          ⌕
          <input
            placeholder="Search Bollywood songs, singers, movies…"
            value={bq}
            onChange={(e) => setBq(e.target.value)}
          />
          {bq && (
            <button className="ib" onClick={() => setBq("")}>
              ×
            </button>
          )}
        </div>
        <div className="chips" style={{ margin: "12px 0 18px" }}>
          {[
            "Arijit Singh",
            "Shreya Ghoshal",
            "90s Bollywood",
            "Romantic Hindi",
            "Atif Aslam",
          ].map((term) => (
            <button key={term} className="chip" onClick={() => setBq(term)}>
              {term}
            </button>
          ))}
        </div>
        {br.err ? <div className="err">{br.err}</div> : null}
        {br.busy && !br.ids.length ? (
          <div className="empty">Loading Bollywood songs…</div>
        ) : null}
        {!br.busy && !br.ids.length && !br.err ? (
          <div className="empty">No songs found. Try another search.</div>
        ) : null}
        {br.ids.length > 0 && (
          <>
            {bq.trim() ? <h2>Search results</h2> : <h2>Bollywood songs</h2>}
            {rows(br.ids, "bolly-")}
          </>
        )}
        <div className="empty" style={{ paddingTop: 16 }}>
          Results combine JioSaavn and Gaana. Stream availability depends on
          each catalog and regional access.
        </div>
      </>
    );
  } else if (v.n === "pakistani") {
    main = (
      <>
        <div className="hhead">
          <div>
            <h2>Pakistani Music</h2>
            <div className="empty" style={{ padding: "0 0 12px" }}>
              Discover Pakistani artists, Urdu and regional music, and Coke Studio.
            </div>
          </div>
        </div>
        <div className="sbox">
          ⌕
          <input
            placeholder="Search Pakistani songs, artists, Coke Studio…"
            value={pq}
            onChange={(e) => setPq(e.target.value)}
          />
          {pq && (
            <button className="ib" onClick={() => setPq("")}>
              ×
            </button>
          )}
        </div>
        <div className="chips" style={{ margin: "12px 0 18px" }}>
          {[
            "Coke Studio Pakistan",
            "Atif Aslam",
            "Rahat Fateh Ali Khan",
            "Young Stunners",
            "Ali Zafar",
            "Pashto music",
            "Sindhi music",
            "Saraiki music",
          ].map((term) => (
            <button key={term} className="chip" onClick={() => setPq(term)}>
              {term}
            </button>
          ))}
        </div>
        {pr.err ? <div className="err">{pr.err}</div> : null}
        {pr.busy && !pr.ids.length ? (
          <div className="empty">Loading Pakistani music…</div>
        ) : null}
        {!pr.busy && !pr.ids.length && !pr.err ? (
          <div className="empty">No songs found. Try another search.</div>
        ) : null}
        {pr.ids.length > 0 && (
          <>
            {pq.trim() ? <h2>Search results</h2> : <h2>Pakistani songs</h2>}
            {rows(pr.ids, "pakistani-")}
          </>
        )}
        <div className="empty" style={{ paddingTop: 16 }}>
          Results combine JioSaavn, Gaana, and Audius. Availability varies by
          catalog and region.
        </div>
      </>
    );
  } else if (v.n === "disc") {
    const multi = !dq.trim() && !dtag;
    main = (
      <>
        <h2>Discover</h2>
        <div className="empty" style={{ padding: "0 0 14px" }}>
          Free full-length music from Jamendo (Creative Commons) and Audius
          (independent artists). Check each track’s licence before reusing it
          anywhere.
        </div>
        <>
          <div className="sbox">
            ⌕
            <input
              placeholder="Search Jamendo & Audius…"
              value={dq}
              onChange={(e) => setDq(e.target.value)}
            />
          </div>
          <div className="chips">
            {[...Object.keys(DESI), ...TAGS].map((t) => (
              <button
                key={t}
                className={"chip cap" + (!dq && dtag === t ? " on" : "")}
                onClick={() => {
                  setDq("");
                  setDtag(dtag === t ? "" : t);
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {dc.err ? (
            <div className="err">{dc.err}</div>
          ) : dc.busy && !dc.shelves.length ? (
            <div className="empty">Loading…</div>
          ) : (
            dc.shelves
              .filter((sh) => !multi || sh.ids.length)
              .map((sh) => (
                <div key={sh.t}>
                  <h2 className="cap">{sh.t}</h2>
                  {sh.ids.length ? (
                    <div className={multi ? "shelf" : "grid"}>
                      {sh.ids.map((id) => tc(id, sh.ids))}
                    </div>
                  ) : (
                    <div className="empty">No results.</div>
                  )}
                </div>
              ))
          )}
        </>
      </>
    );
  } else if (v.n === "fx") {
    main = (
      <>
        <h2>Equalizer</h2>
        <div className="empty" style={{ padding: "0 0 12px" }}>
          Bass booster, 5-band equalizer and 8D effect.
        </div>
        {fxPanel()}
      </>
    );
  } else if (v.n === "hist") {
    const h = (d.hist || []).filter((e) => T[e.id]),
      ids = h.map((e) => e.id);
    const day = (ts) => {
      const dt = new Date(ts),
        n = new Date(),
        a = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()),
        b = new Date(n.getFullYear(), n.getMonth(), n.getDate()),
        df = Math.round((b - a) / 864e5);
      return df <= 0
        ? "Today"
        : df === 1
          ? "Yesterday"
          : dt.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
    };
    const groups = [];
    h.forEach((e, i) => {
      const k = day(e.ts),
        g = groups[groups.length - 1];
      if (g && g.k === k) g.items.push(i);
      else groups.push({ k, items: [i] });
    });
    main = (
      <>
        <div className="hhead">
          <h2>History</h2>
          {h.length > 0 && (
            <button
              className="pill"
              onClick={() => setD((x) => ({ ...x, hist: [] }))}
            >
              Clear history
            </button>
          )}
        </div>
        {h.length ? (
          groups.map((g) => (
            <div key={g.k}>
              <h2>{g.k}</h2>
              {g.items.map((i) => (
                <Row key={"h" + i} id={ids[i]} i={i} list={ids} c={c} />
              ))}
            </div>
          ))
        ) : (
          <div className="empty">Songs you play will show up here.</div>
        )}
      </>
    );
  } else if (v.n === "lib")
    main = (
      <>
        <div className="hhead library-heading">
          <div><h2>Your Library</h2><p className="library-subtitle">Your music, your collections.</p></div>
          <button className="pri" onClick={() => setPlaylistForm({ mode: "create", name: "", description: "", cover: "", isPublic: false })}>＋ Create playlist</button>
        </div>
        <div className="library-section">
          <h3>Playlists & collections</h3>
          <div className="library-collections">{plKeys.map((k) => <Li key={k} k={k} />)}</div>
          <button className="addm library-add-music" onClick={() => fi.current.click()}>＋ Add your music</button>
        </div>
        <div className="library-section">
          <div className="hhead"><h3>Saved albums</h3><span>{savedAlbums.length}</span></div>
          {savedAlbums.length ? <div className="entity-grid album-results">
            {savedAlbums.map((album) => <div className="entity-card album-result" key={album.id}>
              <button className="entity-open" onClick={() => nav("album", album.id)}>
                {album.img ? <img src={album.img} alt="" loading="lazy" /> : <span className="entity-placeholder">♫</span>}
                <b>{album.name}</b><small>{album.artist}{album.year ? " · " + album.year : ""}</small>
              </button>
              <button className="entity-save" onClick={() => toggleAlbumSave(album)}>Remove</button>
            </div>)}
          </div> : <div className="empty">Albums you save will appear here.</div>}
        </div>
        <div className="library-section">
          <div className="hhead"><h3>Followed artists</h3><span>{followedArtists.length}</span></div>
          {followedArtists.length ? <div className="entity-grid artist-results">
            {followedArtists.map((artist) => <div className="entity-card artist-result" key={artist.id}>
              <button className="entity-open" onClick={() => nav("artist", artist.id)}>
                {artist.img ? <img src={artist.img} alt="" loading="lazy" /> : <span className="entity-placeholder">♪</span>}
                <b>{artist.name}</b><small>{artist.role || "Artist"}</small>
              </button>
              <button className="entity-save" onClick={() => toggleArtistFollow(artist)}>Unfollow</button>
            </div>)}
          </div> : <div className="empty">Artists you follow will appear here.</div>}
        </div>
        <div className="library-account">{acct}</div>
      </>
    );
  else if (v.n === "sp") {
    const add = () => {
      const p = spParse(spIn);
      if (!p) return tl("That doesn’t look like a Spotify link");
      if (sp.some((x) => x.id === p.id)) return tl("Already added");
      setD((x) => ({ ...x, sp: [p, ...(x.sp || [])] }));
      setSpIn("");
      E.pause();
      setPlaying(false);
    };
    main = (
      <>
        <h2>Spotify</h2>
        <div className="empty" style={{ padding: "0 0 14px" }}>
          In Spotify tap Share → Copy link on a song, album or playlist, then
          paste it here. Log in to Spotify in this browser for full tracks
          (Premium = no ads).
        </div>
        <div className="sbox">
          <input
            placeholder="https://open.spotify.com/track/…"
            value={spIn}
            onChange={(e) => setSpIn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            className="pill"
            style={{ padding: "5px 14px" }}
            onClick={add}
          >
            Add
          </button>
        </div>
        {sp.length ? (
          sp.map((x, i) => (
            <div key={x.id} style={{ marginBottom: 16 }}>
              <iframe
                title={x.id}
                src={`https://open.spotify.com/embed/${x.k}/${x.id}?utm_source=generator&theme=0`}
                width="100%"
                height={x.k === "track" || x.k === "episode" ? 152 : 352}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{
                  border: 0,
                  borderRadius: 12,
                  maxWidth: 640,
                  display: "block",
                }}
              />
              <button
                className="pill"
                style={{ marginTop: 6, fontSize: 12, padding: "4px 12px" }}
                onClick={() =>
                  setD((y) => ({ ...y, sp: y.sp.filter((_, j) => j !== i) }))
                }
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="empty">No Spotify links yet.</div>
        )}
      </>
    );
  } else {
    const k = v.id,
      p = meta(k),
      customPlaylist = playlists.find((item) => item.id === k),
      ids = idsOf(k),
      tot = ids.reduce((a, id) => a + (T[id]?.dur || 0), 0);
    main = (
      <>
        <div className="hero playlist-hero">
          <div className="big" style={bg(p || { hue: 185 })} />
          <div>
            <small>{customPlaylist ? (customPlaylist.isPublic ? "PUBLIC PLAYLIST" : "PRIVATE PLAYLIST") : "COLLECTION"}</small>
            <h1>{p?.name || "Collection"}</h1>
            <small>{p?.desc || ""} · {ids.length} songs, {Math.round(tot / 60)} min</small>
          </div>
        </div>
        <div className="act">
          <button className="bigp" onClick={() => ids.length && play(ids, ids[0])}>▶</button>
          <button className="pill" onClick={() => {
            if (!ids.length) return;
            setD((x) => ({ ...x, shuf: true }));
            go(ids[0], { ids: shuffle(ids), i: 0 });
          }}>⇄ Shuffle</button>
          {customPlaylist && <>
            <button className="pill" onClick={() => setPlaylistForm({ ...customPlaylist, mode: "edit" })}>Edit details</button>
            {customPlaylist.isPublic && customPlaylist.shareId && <button className="pill" onClick={() => copyPlaylistLink(customPlaylist)}>Copy public link</button>}
            <button className="pill danger-action" onClick={() => deletePlaylist(k)}>Delete</button>
          </>}
          {k === "local" && <button className="pill" onClick={removeAll}>Remove all</button>}
        </div>
        {customPlaylist ? (
          ids.length ? ids.map((id, index) => (
            <div className="playlist-track-row" key={id + "-" + index}>
              <Row id={id} i={index} list={ids} c={c} />
              <div className="playlist-track-actions">
                <button className="ib" title="Move up" disabled={index === 0} onClick={() => movePlaylistTrack(k, index, -1)}>↑</button>
                <button className="ib" title="Move down" disabled={index === ids.length - 1} onClick={() => movePlaylistTrack(k, index, 1)}>↓</button>
                <button className="ib" title="Remove from playlist" onClick={() => removePlaylistTrack(k, id)}>✕</button>
              </div>
            </div>
          )) : <div className="empty">This playlist is empty. Add songs from Search using the playlist icon.</div>
        ) : rows(ids, k)}
      </>
    );
  }

  const pct = dur ? Math.min(1000, (pos / dur) * 1000) : 0;
  const commit = () => {
    if (drag.current) {
      drag.current = false;
      seekTo(pos);
    }
  };
  const toggleFx = () => {
    if (v.n === "fx") {
      setV(pv.current || { n: "home" });
    } else {
      pv.current = v;
      setV({ n: "fx" });
    }
  };
  const NavItem = ({ n, icon, label }) => (
    <div
      className={"nv" + (v.n === n ? " on" : "")}
      onClick={() => (n === "fx" ? toggleFx() : nav(n))}
    >
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span className="nav-label">{label}</span>
    </div>
  );
  return (
    <>
      <div
        id="app"
        className={(d.sc ? "sc" : "") + (d.sw && !d.sc ? " sw" : "")}
      >
        <header id="top">
          <button
            className="lg"
            aria-label="Home"
            onClick={() => {
              setSq("");
              nav("home");
            }}
          >
            W
          </button>
          <div className="tc">
            <button
              className="hb"
              aria-label="Home"
              onClick={() => {
                setSq("");
                nav("home");
              }}
            >
              ⌂
            </button>
            <div className="tsearch">
              <span className="si">⌕</span>
              <input
                placeholder="What do you want to play?"
                value={sq}
                onChange={(e) => {
                  setSq(e.target.value);
                  if (v.n !== "search") nav("search");
                }}
                onFocus={() => {
                  if (v.n !== "search") nav("search");
                }}
              />
              <i className="dv" />
              <button
                className="bro"
                title="Browse"
                aria-label="Browse"
                onClick={() => nav("disc")}
              >
                ▦
              </button>
            </div>
          </div>
          <div className="tr">
            <button className="tl" onClick={() => nav("bollywood")}>
              ♫<span>Bollywood</span>
            </button>
            <button className="tl" onClick={() => nav("pakistani")}>
              ♫<span>Pakistani</span>
            </button>
            <button className="tl" onClick={() => nav("sp")}>
              ♫<span>Spotify</span>
            </button>
            <button
              className={"ic" + (v.n === "fx" ? " on" : "")}
              title="Equalizer"
              onClick={toggleFx}
            >
              🎚
            </button>
            <button
              className={"ic" + (v.n === "hist" ? " on" : "")}
              title="History"
              onClick={() => nav("hist")}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
            </button>
            {user && (
              <div className="sw">
                <button className="av" onClick={() => setAcctOpen((o) => !o)}>
                  {(uname || "?")[0].toUpperCase()}
                </button>
                {acctOpen && (
                  <div className="smenu">
                    <div className="sml">{uname}</div>
                    <button
                      onClick={() => {
                        setAcctOpen(false);
                        E.stopAll();
                        setCur(null);
                        setPlaying(false);
                        fb.logout();
                      }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        {(sortOpen || acctOpen) && (
          <div
            className="scrim"
            onClick={() => {
              setSortOpen(false);
              setAcctOpen(false);
            }}
          />
        )}
        <aside id="side">
          <div className="libbox">
            <div className="lhead">
              <button
                className="lt"
                onClick={() => setD((x) => ({ ...x, sc: !x.sc }))}
                title={d.sc ? "Expand Your Library" : "Collapse Your Library"}
              >
                <span className="lico">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="t">Your Library</span>
              </button>
              <button className="pill sm" onClick={() => fi.current.click()}>
                ＋ Add music
              </button>
              <button
                className="ib xb"
                title={d.sw ? "Shrink" : "Expand"}
                aria-label="Expand"
                onClick={() => setD((x) => ({ ...x, sw: !x.sw }))}
              >
                ⤢
              </button>
            </div>
            <button
              className="addc"
              title="Add music"
              aria-label="Add music"
              onClick={() => fi.current.click()}
            >
              ＋
            </button>
            <div className="chips" style={{ marginBottom: 2 }}>
              <span className="chip">Playlists</span>
            </div>
            <div className="lbar">
              {lsOpen ? (
                <input
                  autoFocus
                  placeholder="Search in Your Library"
                  value={lq}
                  onChange={(e) => setLq(e.target.value)}
                  onBlur={() => {
                    if (!lq) setLsOpen(false);
                  }}
                />
              ) : (
                <button
                  className="ib lsb"
                  title="Search in Your Library"
                  aria-label="Search in Your Library"
                  onClick={() => setLsOpen(true)}
                >
                  ⌕
                </button>
              )}
              <div className="sw">
                <button
                  className="lsort"
                  onClick={() => setSortOpen((o) => !o)}
                >
                  {SORTS[ls]} ☰
                </button>
                {sortOpen && (
                  <div className="smenu">
                    <div className="sml">Sort by</div>
                    {Object.keys(SORTS).map((k) => (
                      <button
                        key={k}
                        className={ls === k ? "on" : ""}
                        onClick={() => {
                          setD((x) => ({ ...x, ls: k }));
                          setSortOpen(false);
                        }}
                      >
                        {SORTS[k]}
                        {ls === k && <span>✓</span>}
                      </button>
                    ))}
                    <div className="sml">View as</div>
                    <div className="vrow">
                      {[
                        ["compact", "≡"],
                        ["list", "☰"],
                        ["grid", "▦"],
                      ].map(([k, l]) => (
                        <button
                          key={k}
                          className={lv === k ? "on" : ""}
                          onClick={() => {
                            setD((x) => ({ ...x, lv: k }));
                            setSortOpen(false);
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div id="libList" className={"lv-" + lv}>
              {libKeys.map((k) => (
                <Li key={k} k={k} />
              ))}
              {!libKeys.length && (
                <div className="empty" style={{ padding: "12px 6px" }}>
                  No matches.
                </div>
              )}
            </div>
          </div>
        </aside>
        <main id="main" ref={mainRef}>
          {main}
        </main>
        <footer
          id="bar"
          onTouchStart={(e) => {
            ty.current.y = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (cur && ty.current.y - e.changedTouches[0].clientY > 40)
              setNpOpen(true);
          }}
        >
          <div className="mp" style={{ width: `calc(${pct / 10}% - 16px)` }} />
          <div className="info" onClick={() => cur && setNpOpen(true)}>
            <div className="cv" style={cur ? bg(cur) : undefined} />
            <div style={{ minWidth: 0 }}>
              <b>{cur ? cur.title : "Nothing playing"}</b>
              <small>{cur ? cur.artist : "Pick a song to start"}</small>
            </div>
            <button
              className={"ib mlk" + (cur && liked.has(cur.id) ? " on" : "")}
              onClick={(e) => {
                e.stopPropagation();
                cur && like(cur.id);
              }}
            >
              ♥
            </button>
          </div>
          <div className="ctr">
            <div className="btnrow">
              <button
                className={"ib shb" + (shuf ? " on" : "")}
                onClick={toggleShuf}
              >
                ⇄
              </button>
              <button className="ib prv" onClick={prev}>
                ⏮
              </button>
              <button className="pp" onClick={toggle}>
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                className="ib queue-trigger queue-trigger-mobile"
                title="Open queue"
                aria-label="Open queue"
                onClick={() => setQueueOpen(true)}
              >
                ☷{q.ids.length > q.i + 1 ? <small>{q.ids.length - q.i - 1}</small> : null}
              </button>
              <button className="ib nxt" onClick={() => next(false)}>
                ⏭
              </button>
              <button
                className={"ib eqb" + (v.n === "fx" ? " on" : "")}
                onClick={toggleFx}
              >
                🎚
              </button>
              <button
                className={"ib rpb" + (rep !== "off" ? " on" : "")}
                onClick={cycleRep}
              >
                {rep === "one" ? "↻1" : "↻"}
              </button>
            </div>
            <div className="seekrow">
              <span>{fmt(pos)}</span>
              <input
                type="range"
                min="0"
                max="1000"
                value={pct}
                style={{ "--p": pct / 10 + "%" }}
                onChange={(e) => {
                  drag.current = true;
                  setPos((e.target.value / 1000) * dur);
                }}
                onPointerUp={commit}
                onKeyUp={commit}
              />
              <span>{fmt(dur)}</span>
            </div>
          </div>
          <div className="right">
            <button
              className={"ib" + (cur && liked.has(cur.id) ? " on" : "")}
              onClick={() => cur && like(cur.id)}
            >
              ♥
            </button>
            <button
              className="ib queue-trigger"
              title="Open queue"
              aria-label="Open queue"
              onClick={() => setQueueOpen(true)}
            >
              ☷{q.ids.length > q.i + 1 ? <small>{q.ids.length - q.i - 1}</small> : null}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={vol * 100}
              style={{ "--p": vol * 100 + "%" }}
              onChange={(e) => {
                const x = e.target.value / 100;
                E.setVol(x);
                setD((y) => ({ ...y, vol: x }));
              }}
            />
          </div>
        </footer>
        <nav id="tabs" aria-label="Main navigation">
          <NavItem n="home" icon="⌂" label="Home" />
          <NavItem n="search" icon="⌕" label="Search" />
          <NavItem n="lib" icon="☰" label="Library" />
          <NavItem n="hist" icon="◷" label="History" />
        </nav>
      </div>
      {queueOpen && (
        <div className="queue-sheet" role="dialog" aria-modal="true" aria-label="Up Next">
          <div className="queue-panel">
            <div className="queue-head">
              <div>
                <small>PLAYING FROM YOUR QUEUE</small>
                <h2>Up Next</h2>
                <p>{Math.max(0, q.ids.length - q.i - 1)} songs in queue</p>
              </div>
              <div className="queue-head-actions">
                <button className="pill sm" onClick={clearQ} disabled={q.ids.length <= q.i + 1}>Clear queue</button>
                <button className="ib" aria-label="Close queue" onClick={() => setQueueOpen(false)}>✕</button>
              </div>
            </div>
            {cur && (
              <div className="queue-current">
                <div className="cv" style={bg(cur)} />
                <div className="queue-track-copy">
                  <small>NOW PLAYING</small>
                  <b>{cur.title}</b>
                  <span>{cur.artist}</span>
                </div>
                <span className="queue-playing-mark">♫</span>
              </div>
            )}
            <div className="queue-list">
              {q.ids.slice(q.i + 1).length ? q.ids.slice(q.i + 1).map((id, offset) => {
                const index = q.i + 1 + offset;
                const track = T[id];
                if (!track) return null;
                return (
                  <div className="queue-item" key={id + "-" + index}>
                    <button className="queue-track" onClick={() => playQueueItem(index)}>
                      <div className="cv" style={bg(track)} />
                      <span className="queue-track-copy"><b>{track.title}</b><small>{track.artist}</small></span>
                    </button>
                    <div className="queue-item-actions">
                      <button title="Move to play next" aria-label={"Move " + track.title + " to play next"} disabled={offset === 0} onClick={() => moveQ(index, q.i + 1)}>↥</button>
                      <button title="Move up" aria-label={"Move " + track.title + " up"} disabled={offset === 0} onClick={() => moveQ(index, index - 1)}>↑</button>
                      <button title="Move down" aria-label={"Move " + track.title + " down"} disabled={index === q.ids.length - 1} onClick={() => moveQ(index, index + 1)}>↓</button>
                      <button title="Remove from queue" aria-label={"Remove " + track.title} onClick={() => removeQ(index)}>✕</button>
                    </div>
                  </div>
                );
              }) : <div className="queue-empty">Your queue is empty. Add songs with the + button to hear them next.</div>}
            </div>
          </div>
        </div>
      )}
      {npOpen && cur && (
        <div
          className="sheet"
          style={{ "--c1": `hsl(${cur.hue || 210} 50% 30%)` }}
          onTouchStart={(e) => {
            ty.current = {
              y: e.touches[0].clientY,
              top: e.currentTarget.scrollTop,
            };
          }}
          onTouchEnd={(e) => {
            if (
              ty.current.top === 0 &&
              e.changedTouches[0].clientY - ty.current.y > 90
            )
              setNpOpen(false);
          }}
        >
          <div className="in">
            <button
              className="grab"
              aria-label="Close"
              onClick={() => setNpOpen(false)}
            />
            <div className="art" style={bg(cur)} />
            <div className="stt">
              <div style={{ minWidth: 0 }}>
                <h3>{cur.title}</h3>
                <small>{cur.artist}</small>
              </div>
              <button
                className={"ib" + (liked.has(cur.id) ? " on" : "")}
                onClick={() => like(cur.id)}
              >
                ♥
              </button>
            </div>
            <div
              className="seekrow"
              style={{ maxWidth: "none", margin: "10px 0" }}
            >
              <span>{fmt(pos)}</span>
              <input
                type="range"
                min="0"
                max="1000"
                value={pct}
                style={{ "--p": pct / 10 + "%" }}
                onChange={(e) => {
                  drag.current = true;
                  setPos((e.target.value / 1000) * dur);
                }}
                onPointerUp={commit}
                onKeyUp={commit}
              />
              <span>{fmt(dur)}</span>
            </div>
            <div
              className="btnrow"
              style={{ justifyContent: "center", gap: 22 }}
            >
              <button
                className={"ib" + (shuf ? " on" : "")}
                onClick={toggleShuf}
              >
                ⇄
              </button>
              <button className="ib" onClick={prev}>
                ⏮
              </button>
              <button
                className="pp"
                style={{ width: 56, height: 56, fontSize: 20 }}
                onClick={toggle}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button className="ib" onClick={() => next(false)}>
                ⏭
              </button>
              <button
                className={"ib" + (rep !== "off" ? " on" : "")}
                onClick={cycleRep}
              >
                {rep === "one" ? "↻1" : "↻"}
              </button>
            </div>
            <h2 className="sh2">Sound</h2>
            {fxPanel()}
          </div>
        </div>
      )}
      <div id="toast" className={msg ? "on" : ""}>
        {msg}
      </div>
      {playlistPicker && (
        <div className="library-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPlaylistPicker(null)}>
          <div className="library-modal" role="dialog" aria-modal="true" aria-labelledby="playlist-picker-title">
            <div className="library-modal-head"><h2 id="playlist-picker-title">Add to playlist</h2><button className="ib" onClick={() => setPlaylistPicker(null)} aria-label="Close">✕</button></div>
            <p>Choose where to add <b>{T[playlistPicker]?.title || "this song"}</b>.</p>
            {playlists.map((item) => <button className="playlist-choice" key={item.id} onClick={() => choosePlaylist(item.id)}>
              <span className="playlist-choice-art" style={item.cover ? { backgroundImage: 'url("' + item.cover + '")' } : {}}>♫</span>
              <span><b>{item.name}</b><small>{item.tracks?.length || 0} songs</small></span>
            </button>)}
            <button className="addm" onClick={() => setPlaylistForm({ mode: "create", name: "", description: "", cover: "", isPublic: false })}>＋ New playlist</button>
          </div>
        </div>
      )}
      {playlistForm && (
        <div className="library-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPlaylistForm(null)}>
          <form className="library-modal" onSubmit={(e) => { e.preventDefault(); savePlaylist(); }}>
            <div className="library-modal-head"><h2>{playlistForm.mode === "edit" ? "Edit playlist" : "Create playlist"}</h2><button type="button" className="ib" onClick={() => setPlaylistForm(null)} aria-label="Close">✕</button></div>
            <label>Playlist name<input autoFocus maxLength={70} required placeholder="Give it a name" value={playlistForm.name || ""} onChange={(e) => setPlaylistForm((x) => ({ ...x, name: e.target.value }))} /></label>
            <label>Description<textarea rows={3} maxLength={240} placeholder="Add an optional description" value={playlistForm.description || ""} onChange={(e) => setPlaylistForm((x) => ({ ...x, description: e.target.value }))} /></label>
            <label>Cover image URL<input type="url" placeholder="https://…" value={playlistForm.cover || ""} onChange={(e) => setPlaylistForm((x) => ({ ...x, cover: e.target.value }))} /></label>
            <label className="playlist-privacy"><input type="checkbox" checked={!!playlistForm.isPublic} disabled={!user} onChange={(e) => setPlaylistForm((x) => ({ ...x, isPublic: e.target.checked }))} /> Public playlist</label>
            <p className="playlist-privacy-note">{user ? "Anyone with this link can view the playlist. They cannot edit it." : "Sign in to publish a playlist and create a share link."}</p>
            <div className="library-modal-actions"><button type="button" className="pill" onClick={() => { setPlaylistForm(null); setPlaylistPicker(null); }}>Cancel</button><button type="submit" className="pri">{playlistForm.mode === "edit" ? "Save changes" : "Create playlist"}</button></div>
          </form>
        </div>
      )}
      <input
        ref={fi}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={addFiles}
      />
    </>
  );
}

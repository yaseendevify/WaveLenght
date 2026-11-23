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
        hue: [...String(x.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
      };
      return id;
    });
};
const audSearch = (q) => audGet("/tracks/search", { query: q, limit: 30 });
const SAAVN = "https://saavn.bycomsolutions.com";
const saavnSearchSongs = async (query, page = 0) => {
  const u = new URL(SAAVN + "/api/search/songs");
  u.searchParams.set("query", query);
  u.searchParams.set("page", String(page));
  u.searchParams.set("limit", "20");
  const r = await fetch(u);
  if (!r.ok) throw new Error("JioSaavn search failed (" + r.status + ")");
  const j = await r.json();
  if (j.success === false) throw new Error(j.message || "JioSaavn request failed");
  return (j.data?.results || []).map((x) => {
    const id = "s" + x.id;
    const images = Array.isArray(x.image) ? x.image : [];
    const audio = Array.isArray(x.downloadUrl) ? x.downloadUrl : [];
    const bestAudio = [...audio].sort((a, b) =>
      parseInt(b.quality || "0", 10) - parseInt(a.quality || "0", 10),
    )[0]?.url;
    const bestImage = [...images].sort((a, b) =>
      parseInt(b.quality || "0", 10) - parseInt(a.quality || "0", 10),
    )[0]?.url;
    const artist = x.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ")
      || x.artists?.all?.map((a) => a.name).filter(Boolean).join(", ")
      || x.album?.name || "Unknown artist";
    T[id] = T[id] || {
      id,
      title: x.name || "Unknown title",
      artist,
      g: "saavn",
      url: bestAudio || "",
      dur: Number(x.duration) || 0,
      img: bestImage || "",
      hue: [...String(x.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
      album: x.album?.name || "",
      sourceUrl: x.url || "",
    };
    return id;
  });
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
  if (j.status === false || j.success === false) throw new Error(j.message || "Gaana search failed");
  const list = Array.isArray(j) ? j : (j.results || j.data?.results || j.data || j.songs || []);
  return list.filter((x) => x && typeof x === "object").map((x) => {
    const key = x.seokey || x.seo_key || x.slug || (x.gaana_url || x.url || "").split("/").filter(Boolean).pop();
    const id = "g" + (x.id || key || encodeURIComponent(x.title || x.name || Math.random()));
    const title = x.title || x.name || x.track_title || "Unknown title";
    const artist = x.artist || x.artist_name || x.singer || x.primary_artist || "Unknown artist";
    const direct = x.link || x.stream_url || x.audio_url || x.audio || "";
    T[id] = T[id] || {
      id, title, artist, g: "gaana", url: direct,
      dur: Number(x.duration_seconds) || (Number.isFinite(Number(x.duration)) ? Number(x.duration) : 0),
      img: x.thumb || x.image || x.artwork || x.album_art || "",
      hue: [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
      album: x.album || x.album_title || "", seokey: key,
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
const YKEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const ytParse = (x) => {
  x = x.trim();
  const v = x.match(
    /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/,
  );
  if (v) return { k: "v", id: v[1] };
  const l = x.match(/[?&]list=([\w-]+)/);
  return l && /youtube\.com/.test(x) ? { k: "p", id: l[1] } : null;
};
const YSRV = import.meta.env.VITE_YTMUSIC_URL || "http://localhost:5174";
const dec = (s) => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
};
const ytSearch = async (q) => {
  try {
    const r = await fetch(YSRV + "/api/search?q=" + encodeURIComponent(q));
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || "server error");
    return j.map((x) => ({
      k: "v",
      id: x.videoId,
      title: x.title,
      ch: x.artist,
      img: x.thumb,
    }));
  } catch (e) {
    if (!YKEY)
      throw new Error(
        "Search server chal nahi raha. Terminal mein server.py wale folder mein ye chalayein: python server.py",
      );
    const u = new URL("https://www.googleapis.com/youtube/v3/search");
    Object.entries({
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      videoCategoryId: "10",
      maxResults: 12,
      q,
      key: YKEY,
    }).forEach(([a, b]) => u.searchParams.set(a, b));
    const j = await (await fetch(u)).json();
    if (j.error) throw new Error(j.error.message);
    return (j.items || []).map((i) => ({
      k: "v",
      id: i.id.videoId,
      title: dec(i.snippet.title),
      ch: dec(i.snippet.channelTitle),
    }));
  }
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
const homeJobs = () => [
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
    t: "Pakistani music on Audius",
    f: () => audSearch("Pakistani music"),
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
        onClick={(e) => {
          e.stopPropagation();
          c.addQ(id);
        }}
      >
        ＋
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined),
    [guest, setGuest] = useState(false),
    [ready, setReady] = useState(false);
  const [d, setD] = useState(readLocal),
    [local, setLocal] = useState([]);
  const [v, setV] = useState({ n: "home" }),
    [sq, setSq] = useState(""),
    [spIn, setSpIn] = useState(""),
    [ytIn, setYtIn] = useState(""),
    [ytq, setYtq] = useState(""),
    [ytSub, setYtSub] = useState(""),
    [ytr, setYtr] = useState({ items: [], busy: false, err: "" }),
    [ytCur, setYtCur] = useState(null),
    [ytCh, setYtCh] = useState(null),
    [npOpen, setNpOpen] = useState(false),
    [lq, setLq] = useState(""),
    [lsOpen, setLsOpen] = useState(false),
    [sortOpen, setSortOpen] = useState(false),
    [acctOpen, setAcctOpen] = useState(false),
    [hm, setHm] = useState({ shelves: [], loaded: false });
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
    sv = useRef();
  const liked = new Set(d.liked || []),
    rep = d.rep || "off",
    shuf = !!d.shuf,
    vol = d.vol ?? 0.8,
    sp = d.sp || [];
  (d.jam || []).forEach((j) => {
    if (!T[j.id])
      T[j.id] = { ...j, g: String(j.id)[0] === "a" ? "audius" : String(j.id)[0] === "s" ? "saavn" : String(j.id)[0] === "g" ? "gaana" : "jamendo" };
  });
  (d.hist || []).forEach((h) => {
    if (h.url && !T[h.id])
      T[h.id] = { ...h, g: String(h.id)[0] === "a" ? "audius" : String(h.id)[0] === "s" ? "saavn" : String(h.id)[0] === "g" ? "gaana" : "jamendo" };
  });
  const [dc, setDc] = useState({ shelves: [], busy: false, err: "" }),
    [dq, setDq] = useState(""),
    [dtag, setDtag] = useState(""),
    [sr, setSr] = useState({ ids: [], aids: [], saavn: [], gaana: [], busy: false, err: "" }),
    [bq, setBq] = useState(""),
    [br, setBr] = useState({ ids: [], busy: false, err: "" });
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
  const idsOf = (k) =>
    k === "liked"
      ? [...liked].filter((x) => T[x])
      : k === "local"
        ? local
        : [];
  const meta = (k) =>
    k === "liked"
      ? { name: "Liked Songs", desc: "Songs you’ve hearted", hue: 280 }
      : k === "local"
        ? { name: "Your music", desc: "Files from your device", hue: 160 }
        : null;

  /* player */
  const go = async (id, nq, auto = true) => {
    let t = T[id];
    if (t && t.g === "gaana" && !t.url) {
      try { t = await resolveGaanaStream(t); T[id] = t; }
      catch (e) { tl(String(e.message || e)); }
    }
    setYtCur(null);
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
      else return go(q.ids[0], { ...q, i: 0 }, false);
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
      if (!on && t && (t.g === "jamendo" || t.g === "audius" || t.g === "saavn"))
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
    setQ((x) => ({
      ids: [...x.ids.slice(0, x.i + 1), id, ...x.ids.slice(x.i + 1)],
      i: x.i,
    }));
    tl("Added to queue");
  };
  R.current = { q, rep, cur, playing, next, toggle, prev, like, toggleShuf };
  const c = { cur, playing, liked, play, like, addQ };

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
      if (r.playing && E.ended()) r.next(true);
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
      setSr({ ids: [], aids: [], saavn: [], gaana: [], busy: false, err: "" });
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
        ]).then(
          ([a, b, c, d]) =>
            !dead &&
            setSr({
              ids: a.status === "fulfilled" ? a.value : [],
              aids: b.status === "fulfilled" ? b.value : [],
              saavn: c.status === "fulfilled" ? c.value : [],
              gaana: d.status === "fulfilled" ? d.value : [],
              busy: false,
              err:
                a.status === "rejected" && b.status === "rejected" && c.status === "rejected" && d.status === "rejected"
                  ? String((c.reason && c.reason.message) || c.reason)
                  : "",
            }),
        ),
      400,
    );
    return () => {
      dead = true;
      clearTimeout(h);
    };
  }, [v.n, sq]);

  useEffect(() => {
    if (v.n !== "bollywood") return;
    const query = bq.trim() || "Bollywood";
    let dead = false;
    setBr((x) => ({ ...x, busy: true, err: "" }));
    const h = setTimeout(() => {
      Promise.allSettled([saavnSearchSongs(query), gaanaSearchSongs(query)]).then(([saavn, gaana]) => {
        if (dead) return;
        const ids = [...(saavn.status === "fulfilled" ? saavn.value : []), ...(gaana.status === "fulfilled" ? gaana.value : [])];
        const seen = new Set();
        const unique = ids.filter((id) => {
          const t = T[id];
          const key = (t.title + "|" + t.artist).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        setBr({ ids: unique, busy: false, err: unique.length ? "" : String((saavn.reason || gaana.reason || {}).message || "No results from music sources") });
      });
    }, bq.trim() ? 350 : 0);
    return () => { dead = true; clearTimeout(h); };
  }, [v.n, bq]);

  useEffect(() => {
    if (v.n !== "yt") return;
    const q = ytSub.trim();
    if (!q) {
      setYtr({ items: [], busy: false, err: "" });
      return;
    }
    let dead = false;
    setYtr((x) => ({ ...x, busy: true, err: "" }));
    ytSearch(q)
      .then((items) => !dead && setYtr({ items, busy: false, err: "" }))
      .catch(
        (e) =>
          !dead &&
          setYtr({ items: [], busy: false, err: String(e.message || e) }),
      );
    return () => {
      dead = true;
    };
  }, [v.n, ytSub]);
  useEffect(() => {
    if (v.n !== "yt" || (ytCh && ytCh.some((g) => g.items.length))) return;
    let dead = false;
    Promise.all(
      ["PK", "IN"].map((c) =>
        fetch(YSRV + "/api/charts?country=" + c)
          .then((r) => r.json())
          .then((j) => ({
            c,
            items: Array.isArray(j)
              ? j.map((x) => ({
                  k: "p",
                  id: x.playlistId,
                  title: x.title,
                  img: x.thumb,
                }))
              : [],
          }))
          .catch(() => ({ c, items: [] })),
      ),
    ).then((r) => !dead && setYtCh(r));
    return () => {
      dead = true;
    };
  }, [v.n]);

  const ty = useRef({ y: 0, top: 0 }),
    pv = useRef({ n: "home" });
  useEffect(() => {
    if (v.n !== "home" || hm.loaded) return;
    let dead = false;
    loadShelves(homeJobs()).then(
      (sh) => !dead && setHm({ shelves: sh, loaded: true }),
    );
    return () => {
      dead = true;
    };
  }, [v.n]);
  useEffect(() => {
    E.setFx(
      d.fx || { bass: 0, pre: 0, bands: [0, 0, 0, 0, 0], spatial: false },
    );
  }, [d.fx]);

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
  const plKeys = ["liked", ...(local.length ? ["local"] : [])];
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
          They don’t work on the YouTube and Spotify players.
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
        {hm.shelves
          .filter((x) => x.ids.length)
          .map((sh) => (
            <div key={sh.t}>
              <h2>{sh.t}</h2>
              <div className="shelf">{sh.ids.map((id) => tc(id, sh.ids))}</div>
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
    const s = sq.trim().toLowerCase(),
      jset = new Set([...sr.ids, ...sr.aids, ...(sr.saavn || []), ...(sr.gaana || [])]);
    const res = s
      ? allIds().filter(
          (id) =>
            !jset.has(id) &&
            (T[id].title + " " + T[id].artist + " " + GL[T[id].g])
              .toLowerCase()
              .includes(s),
        )
      : [];
    const cats = [
      ...new Map(
        [
          ...Object.keys(GL)
            .filter((k) => k !== "local" && k !== "jamendo" && k !== "audius")
            .map((k) => GL[k]),
          ...Object.keys(DESI),
          ...TAGS,
        ].map((n) => [n.toLowerCase(), n]),
      ).values(),
    ];
    main = (
      <>
        {s ? (
          <>
            {sr.err ? (
              <div className="err">{sr.err}</div>
            ) : (
              <>
                <h2>From JioSaavn</h2>
                {sr.busy && !(sr.saavn || []).length ? (
                  <div className="empty">Searching JioSaavn…</div>
                ) : (sr.saavn || []).length ? (
                  rows(sr.saavn, "saavn-search-")
                ) : (
                  <div className="empty">No Bollywood songs found for “{sq}”.</div>
                )}
                <h2>From Gaana</h2>
                {sr.busy && !(sr.gaana || []).length ? <div className="empty">Searching Gaana…</div> : (sr.gaana || []).length ? rows(sr.gaana, "gaana-search-") : <div className="empty">No Gaana results for “{sq}”.</div>}
                {JKEY && (
                  <>
                    <h2>From Jamendo</h2>
                    {sr.busy && !sr.ids.length ? (
                      <div className="empty">Searching…</div>
                    ) : sr.ids.length ? (
                      rows(sr.ids, "j")
                    ) : (
                      <div className="empty">
                        No songs found on Jamendo for “{sq}”.
                      </div>
                    )}
                  </>
                )}
                <h2>From Audius</h2>
                {sr.busy && !sr.aids.length ? (
                  <div className="empty">Searching…</div>
                ) : sr.aids.length ? (
                  rows(sr.aids, "au")
                ) : (
                  <div className="empty">
                    No songs found on Audius for “{sq}”.
                  </div>
                )}
              </>
            )}
            {res.length > 0 && (
              <>
                <h2>In your library</h2>
                {rows(res, "s")}
              </>
            )}
          </>
        ) : (
          <>
            <h2>Browse all</h2>
            <div className="cats">
              {cats.map((n, i) => (
                <div
                  key={n}
                  className="cat cap"
                  style={{ background: `hsl(${i * 47 + 20} 60% 40%)` }}
                  onClick={() => setSq(n)}
                >
                  {n}
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  } else if (v.n === "bollywood") {
    main = (
      <>
        <div className="hhead">
          <div>
            <h2>Bollywood</h2>
            <div className="empty" style={{ padding: "0 0 12px" }}>Explore Hindi film music across JioSaavn and Gaana catalogs.</div>
          </div>
        </div>
        <div className="sbox">
          ⌕
          <input
            placeholder="Search Bollywood songs, singers, movies…"
            value={bq}
            onChange={(e) => setBq(e.target.value)}
          />
          {bq && <button className="ib" onClick={() => setBq("")}>×</button>}
        </div>
        <div className="chips" style={{ margin: "12px 0 18px" }}>
          {["Arijit Singh", "Shreya Ghoshal", "90s Bollywood", "Romantic Hindi", "Atif Aslam"].map((term) => (
            <button key={term} className="chip" onClick={() => setBq(term)}>{term}</button>
          ))}
        </div>
        {br.err ? <div className="err">{br.err}</div> : null}
        {br.busy && !br.ids.length ? <div className="empty">Loading Bollywood songs…</div> : null}
        {!br.busy && !br.ids.length && !br.err ? <div className="empty">No songs found. Try another search.</div> : null}
        {br.ids.length > 0 && <>{bq.trim() ? <h2>Search results</h2> : <h2>Bollywood songs</h2>}{rows(br.ids, "bolly-")}</>}
        <div className="empty" style={{ paddingTop: 16 }}>Results combine JioSaavn and Gaana. Stream availability depends on each catalog and regional access.</div>
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
  } else if (v.n === "yt") {
    const yt = d.yt || [];
    const playY = (x) => {
      E.pause();
      setPlaying(false);
      setYtCur(x);
    };
    const addY = (x) => {
      if (yt.some((y) => y.id === x.id)) return tl("Already saved");
      setD((z) => ({ ...z, yt: [x, ...(z.yt || [])] }));
      tl("Saved");
    };
    const add = () => {
      const p = ytParse(ytIn);
      if (!p) return tl("That doesn’t look like a YouTube link");
      addY(p);
      playY(p);
      setYtIn("");
    };
    const emb = (x) =>
      x.k === "p"
        ? `https://www.youtube-nocookie.com/embed/videoseries?list=${x.id}&autoplay=1`
        : `https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&rel=0`;
    const yrow = (x, save) => (
      <div key={x.id} className="yrow" onClick={() => playY(x)}>
        <div
          className="yth"
          style={
            x.img || x.k === "v"
              ? {
                  backgroundImage: `url(${x.img || "https://i.ytimg.com/vi/" + x.id + "/mqdefault.jpg"})`,
                }
              : null
          }
        >
          {x.k === "p" && !x.img && "☰"}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b>
            {x.title || (x.k === "p" ? "YouTube playlist" : "YouTube video")}
          </b>
          <small>{x.ch || ""}</small>
        </div>
        {save ? (
          <button
            className="pill"
            style={{ fontSize: 12, padding: "4px 12px" }}
            onClick={(e) => {
              e.stopPropagation();
              addY(x);
            }}
          >
            ＋ Save
          </button>
        ) : (
          <button
            className="pill"
            style={{ fontSize: 12, padding: "4px 12px" }}
            onClick={(e) => {
              e.stopPropagation();
              setD((z) => ({
                ...z,
                yt: (z.yt || []).filter((y) => y.id !== x.id),
              }));
              if (ytCur && ytCur.id === x.id) setYtCur(null);
            }}
          >
            Remove
          </button>
        )}
      </div>
    );
    main = (
      <>
        <h2>YouTube</h2>
        <div className="empty" style={{ padding: "0 0 14px" }}>
          Songs play in YouTube’s own player (ads can appear). Search a song
          below, or paste a video / playlist link.
        </div>
        {ytCur && (
          <iframe
            className="yplayer"
            src={emb(ytCur)}
            title="YouTube player"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
        <div className="sbox">
          <input
            placeholder="https://www.youtube.com/watch?v=…"
            value={ytIn}
            onChange={(e) => setYtIn(e.target.value)}
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
        <>
          <div className="sbox">
            ⌕
            <input
              placeholder="Search any song (press Enter)…"
              value={ytq}
              onChange={(e) => setYtq(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setYtSub(ytq)}
            />
          </div>
          {ytr.err ? (
            <div className="err">{ytr.err}</div>
          ) : ytr.busy ? (
            <div className="empty">Searching…</div>
          ) : (
            ytr.items.length > 0 && (
              <>
                <h2>Results</h2>
                {ytr.items.map((x) => yrow(x, true))}
              </>
            )
          )}
        </>
        {!ytr.items.length &&
          !ytr.busy &&
          !ytr.err &&
          ytCh &&
          ytCh.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.c}>
                  <h2>
                    {g.c === "PK"
                      ? "Top charts · Pakistan"
                      : "Top charts · India"}
                  </h2>
                  {g.items.map((x) => yrow(x, true))}
                </div>
              ),
          )}
        <h2>Saved</h2>
        {yt.length ? (
          yt.map((x) => yrow(x, false))
        ) : (
          <div className="empty">Nothing saved yet.</div>
        )}
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
        <h2>Your Library</h2>
        {plKeys.map((k) => (
          <Li key={k} k={k} />
        ))}
        <button
          className="addm"
          style={{ marginTop: 16, width: "100%" }}
          onClick={() => fi.current.click()}
        >
          ＋ Add your music
        </button>
        <div style={{ marginTop: 10 }}>{acct}</div>
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
      ids = idsOf(k),
      tot = ids.reduce((a, id) => a + (T[id].dur || 0), 0);
    main = (
      <>
        <div className="hero">
          <div className="big" style={bg(p)} />
          <div>
            <small>COLLECTION</small>
            <h1>{p.name}</h1>
            <small>
              {p.desc} · {ids.length} songs, {Math.round(tot / 60)} min
            </small>
          </div>
        </div>
        <div className="act">
          <button
            className="bigp"
            onClick={() => ids.length && play(ids, ids[0])}
          >
            ▶
          </button>
          <button
            className="pill"
            onClick={() => {
              if (!ids.length) return;
              setD((x) => ({ ...x, shuf: true }));
              go(ids[0], { ids: shuffle(ids), i: 0 });
            }}
          >
            ⇄ Shuffle
          </button>
          {k === "local" && (
            <button className="pill" onClick={removeAll}>
              Remove all
            </button>
          )}
        </div>
        {rows(ids, k)}
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
      {icon}
      <span>{label}</span>
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
            <button className="tl" onClick={() => nav("sp")}>
              ♫<span>Spotify</span>
            </button>
            <button className="tl" onClick={() => nav("yt")}>
              ▶<span>YouTube</span>
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
              🕘
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
        <nav id="tabs">
          <NavItem n="home" icon="⌂" label="Home" />
          <NavItem n="search" icon="⌕" label="Search" />
          <NavItem n="bollywood" icon="♫" label="Bollywood" />
          <NavItem n="disc" icon="✦" label="Discover" />
          <NavItem n="sp" icon="♫" label="Spotify" />
          <NavItem n="yt" icon="▶" label="YouTube" />
          <NavItem n="lib" icon="☰" label="Library" />
        </nav>
      </div>
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

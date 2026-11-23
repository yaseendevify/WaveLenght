"""Local search server for Wavelength (search + metadata only).

Run:   pip install ytmusicapi
       python server.py
It listens on http://127.0.0.1:5174 (this PC only) and returns song metadata
(videoId, title, artist, cover, duration). Playback happens in the app through
YouTube's official embedded player, so no audio is fetched or served here.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from ytmusicapi import YTMusic

PORT = 5174
yt = YTMusic()


def thumb(items):
    return items[-1].get("url", "") if items else ""


def search(text):
    res = yt.search(text, filter="songs", limit=20)
    if not res:
        res = yt.search(text, filter="videos", limit=20)
    return [
        {
            "videoId": r.get("videoId"),
            "title": r.get("title"),
            "artist": ", ".join(a.get("name", "") for a in (r.get("artists") or [])),
            "thumb": thumb(r.get("thumbnails")),
            "duration": r.get("duration"),
        }
        for r in res
        if r.get("videoId")
    ]


def charts(country):
    data = yt.get_charts(country)
    return [
        {"title": v.get("title"), "playlistId": v.get("playlistId"), "thumb": thumb(v.get("thumbnails"))}
        for v in (data.get("videos") or [])
        if v.get("playlistId")
    ]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path == "/api/health":
                return self._send(200, {"ok": True})
            if u.path == "/api/search":
                text = (q.get("q", [""])[0]).strip()
                return self._send(200, search(text) if text else [])
            if u.path == "/api/charts":
                country = (q.get("country", ["PK"])[0] or "PK").upper()[:2]
                return self._send(200, charts(country))
            self._send(404, {"error": "not found"})
        except Exception as e:  # keep the server alive on upstream errors
            self._send(500, {"error": str(e)})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"Wavelength search server running on http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

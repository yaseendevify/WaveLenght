const { app, BrowserWindow, ipcMain, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const APP_URL = "https://wavelength-d6a7c.web.app/";
const DEV_URL = process.env.WAVELENGTH_DEV_URL;
const isDev = Boolean(DEV_URL);
const rendererDir = path.resolve(__dirname, "../dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

let mainWindow;
let localServer;
let pendingGoogleLogin;
let protocolCallback;

const deliverGoogleResult = (parsedUrl) => {
  if (parsedUrl.protocol !== "wavelength:" || parsedUrl.hostname !== "auth" || parsedUrl.pathname !== "/callback") return false;
  const state = parsedUrl.searchParams.get("state");
  const idToken = parsedUrl.searchParams.get("idToken");
  if (!pendingGoogleLogin || state !== pendingGoogleLogin.state || !idToken || idToken.length > 8192) return false;

  clearTimeout(pendingGoogleLogin.timeout);
  pendingGoogleLogin.webContents.send("wavelength:google-result", { idToken });
  pendingGoogleLogin = null;
  return true;
};

const handleProtocolUrl = (value) => {
  try {
    const parsedUrl = new URL(value);
    if (!deliverGoogleResult(parsedUrl)) return;
  } catch {
    return;
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
};

if (process.platform === "darwin") {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith("wavelength://"));
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAsDefaultProtocolClient("wavelength");

    if (process.platform !== "darwin") {
      const url = process.argv.find((arg) => arg.startsWith("wavelength://"));
      if (url) handleProtocolUrl(url);
    }

    const appOrigin = isDev ? new URL(DEV_URL).origin : null;
    if (!isDev) {
      localServer = http.createServer((request, response) => {
        let requestedPath;
        try {
          requestedPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        } catch {
          response.writeHead(400).end("Bad request");
          return;
        }
        const resolved = path.resolve(rendererDir, `.${requestedPath}`);
        if (resolved !== rendererDir && !resolved.startsWith(`${rendererDir}${path.sep}`)) {
          response.writeHead(403).end("Forbidden");
          return;
        }
        fs.stat(resolved, (error, stats) => {
          const filePath = !error && stats.isFile() ? resolved : path.join(rendererDir, "index.html");
          fs.readFile(filePath, (readError, contents) => {
            if (readError) {
              response.writeHead(404).end("Not found");
              return;
            }
            response.setHeader("Content-Type", mimeTypes[path.extname(filePath)] || "application/octet-stream");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.writeHead(200).end(contents);
          });
        });
      });
      await new Promise((resolve, reject) => {
        localServer.once("error", reject);
        localServer.listen(0, "localhost", resolve);
      });
    }

    const loadUrl = isDev
      ? DEV_URL
      : `http://localhost:${localServer.address().port}/`;
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 860,
      minHeight: 640,
      title: "Wavelength",
      backgroundColor: "#111116",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
      return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      const target = new URL(url);
      const allowed = isDev ? target.origin === appOrigin : target.origin === `http://localhost:${localServer.address().port}`;
      if (!allowed) {
        event.preventDefault();
        if (target.protocol === "http:" || target.protocol === "https:") shell.openExternal(url);
      }
    });

    await mainWindow.loadURL(loadUrl);
    mainWindow.on("closed", () => { mainWindow = null; });
  });

  ipcMain.handle("wavelength:google-start", async (event) => {
    if (pendingGoogleLogin) throw new Error("A Google sign-in is already waiting for approval");
    const state = crypto.randomBytes(24).toString("hex");
    pendingGoogleLogin = {
      state,
      webContents: event.sender,
      timeout: setTimeout(() => {
        if (!pendingGoogleLogin || pendingGoogleLogin.state !== state) return;
        pendingGoogleLogin.webContents.send("wavelength:google-result", { error: "Google sign-in timed out" });
        pendingGoogleLogin = null;
      }, 5 * 60 * 1000),
    };
    const browserUrl = new URL(APP_URL);
    browserUrl.searchParams.set("desktopAuth", state);
    try {
      await shell.openExternal(browserUrl.href);
    } catch (error) {
      clearTimeout(pendingGoogleLogin.timeout);
      pendingGoogleLogin = null;
      throw error;
    }
    return true;
  });
}

app.on("window-all-closed", () => {
  if (localServer) localServer.close();
  if (process.platform !== "darwin") app.quit();
});

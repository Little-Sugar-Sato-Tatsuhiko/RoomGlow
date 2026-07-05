const { app, BrowserWindow, Tray, Menu, globalShortcut, screen } = require("electron");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");

let mainWindow = null;
let tray = null;
let serverPort = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get({ host: "127.0.0.1", port, path: "/api/status" }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for server to start"));
          return;
        }
        setTimeout(attempt, 200);
      });
    }
    attempt();
  });
}

function startServer() {
  process.env.NODE_ENV = "production";
  process.env.PORT = String(serverPort);
  process.env.APP_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.APP_VIDEOS_DIR = path.join(app.getPath("userData"), "videos");
  process.env.APP_STATIC_DIR = app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.join(__dirname, "..", "dist");

  require("./server-bundle.cjs");
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/display`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openAdmin() {
  if (!mainWindow) return;
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/admin`);
}

function openDisplay() {
  if (!mainWindow) return;
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/display`);
}

function toggleFullScreen() {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

function createTray() {
  tray = new Tray(path.join(__dirname, "icon.png"));
  tray.setToolTip("RoomGlow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "ディスプレイ画面を表示", click: openDisplay },
      { label: "管理画面を開く", click: openAdmin },
      { label: "フルスクリーン切替", click: toggleFullScreen },
      { type: "separator" },
      { label: "終了", click: () => app.quit() },
    ])
  );
}

app.whenReady().then(async () => {
  serverPort = await getFreePort();
  startServer();
  await waitForServer(serverPort);

  createWindow();
  createTray();

  globalShortcut.register("CommandOrControl+Shift+A", openAdmin);
  globalShortcut.register("CommandOrControl+Shift+D", openDisplay);
  globalShortcut.register("F11", toggleFullScreen);
  globalShortcut.register("CommandOrControl+Q", () => app.quit());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

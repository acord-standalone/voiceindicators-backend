const io = new (require("socket.io").Server)({
  transports: ["websocket"]
});
const readdirRecursive = require("recursive-readdir");
const path = require("path");
const logUpdate = require("log-update");
const exchangeToken = require("./utils/exchangeToken.js");

let stats = {
  mps: 0,
  _mps: 0,
  logs: []
}

function log(...msg) {
  stats.logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg.join(" ")}`);
  stats.logs.length = 12;
}

global.log = log;

setInterval(() => {
  stats.mps = stats._mps;
  stats._mps = 0;
}, 1000);

const BLOCKED_IPS = new Set();

setInterval(() => {
  BLOCKED_IPS.clear();
}, 60000 * 60);

(async () => {
  console.clear();

  const listeners = new Map();
  let files = await readdirRecursive(path.join(__dirname, "./listeners"));
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    let socketListener = require(filePath);
    listeners.set(socketListener.name, socketListener);
  }
  io.on("connection", (socket) => {
    let socketIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
    if (BLOCKED_IPS.has(socketIp)) {
      socket.disconnect(true);
      return;
    }

    let destroyers = new Map();

    function awaitResponse(eventName, data, timeout = Infinity) {
      return new Promise((resolve) => {
        let done = false;
        socket.emit(eventName, data, (r) => {
          if (done) return;
          resolve(r);
          stats._mps++;
        });
        if (timeout != Infinity) {
          setTimeout(() => {
            done = true;
            resolve({ ok: false, error: "Timeout" });
          }, timeout);
        }
      })
    }

    function getUserSocket(id) {
      return [...io.sockets.sockets.values()].find(i => i.data.id == id);
    }

    socket.data.awaitResponse = awaitResponse;

    let onAny = async (eventName, data = {}, cb) => {
      if (eventName?.startsWith(":")) return;
      stats._mps++;
      let id = Math.random().toString(36).slice(2);
      try {
        if (!socket.data.id) throw "UNS";
        let listener = listeners.get(eventName);
        if (!listener) throw "Unable to find listener!";
        if (!(typeof data == "object" || typeof data == "undefined")) throw "Data can only be object or undefined!";
        let result = listener.execute(socket, data, { socketIp, awaitResponse, io, getUserSocket });
        destroyers.set(id, result.cancel);
        if (typeof cb === "function") cb({ ok: true, data: await result.promise });
      } catch (err) {
        if (typeof cb === "function") cb({ ok: false, error: `[$${eventName}] ${err}\n${err?.stack || ""}`.trim() });
        if (["Cancelled", "UNS", "Unable to find"].some(i => `${err}`.includes(i))) return;
        log("[SOCKET ERROR]", socketIp, "->", `[${eventName}] ${err}\n${err?.stack || ""}`.trim());
      } finally {
        destroyers.delete(id);
      }
    };

    socket.on(":login", async (data, cb) => {
      if (typeof data != "object") return;
      if (typeof data.acordToken != "string") return;

      socket.data.acordToken = data.acordToken;
      let userId = await exchangeToken(data.acordToken);
      if (!userId) return cb({ ok: false, error: "Invalid token!" });

      if (socket.data.id) {
        onAny("disconnect", {}, () => { });
        socket.leave(`user:${socket.data.id}`);
      }
      socket.data.id = userId;
      socket.join(`user:${data.id}`);

      log(`Socket connected! ${socketIp} ${socket.data.id} (${io.sockets.sockets.size})`);

      if (typeof cb == "function") cb();
    });

    socket.onAny(onAny);
    socket.once("disconnect", () => {
      destroyers.forEach(f => {
        f();
      });
      destroyers.clear();
      onAny("disconnect", {}, () => { });
      socket.offAny(onAny);
      if (!BLOCKED_IPS.has(socketIp)) log(`Socket disconnected! ${socketIp} ${socket.data.id} (${io.sockets.sockets.size})`);
    });
  });

  setInterval(() => {
    let text = `[${new Date().toLocaleTimeString()}] Voice Indicators Backend (*:2024)\n\n`;
    text += `Messages Per Second: ${stats.mps}\n`;
    text += `Connections: ${io.sockets.sockets.size}\n`;
    text += `\nLogs:\n${stats.logs.map(i => `- ${i || ""}`).join("\n")}`;
    logUpdate(text);
  }, 100);

})();

io.listen(2024);

setInterval(() => {
  global.gc();
}, 1000);
global.gc();
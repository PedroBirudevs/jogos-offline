// Jogos de Viagem — servidor local, sem internet e sem dependências.
// Rode com:  node server.js   (porta padrão 3000)
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 3000;
const PUB = path.join(__dirname, "public");

const GAMES = {};
for (const f of fs.readdirSync(path.join(__dirname, "games"))) {
  if (f.endsWith(".js")) { const g = require("./games/" + f); GAMES[g.key] = g; }
}

// ---------------- Estado ----------------
const players = new Map(); // id -> {id, name, conns:Set, lastSeen}
const anon = new Map();    // res -> pid (ainda não entrou)
let order = [];            // ordem de entrada
let hostId = null;
let game = null;           // {key, st}
let lastResult = null;     // {titulo, linhas:[{nome, pontos}]}
let timers = [];

const now = () => Date.now();
// cada celular manda um "oi" a cada 4s; quem some por 12s conta como fora (conexão morta não engana mais)
const online = (p) => now() - p.lastSeen < 12000;
const nameOf = (id) => (players.get(id) || {}).name || "?";

// endereços desta máquina: o do roteador (hotspot) vem primeiro
let endCache = { t: 0, v: [] };
function enderecos() {
  if (Date.now() - endCache.t < 5000) return endCache.v;
  const out = [];
  try {
    for (const [nome, list] of Object.entries(os.networkInterfaces()))
      for (const i of list || []) if (i.family === "IPv4" && !i.internal) {
        const movel = /rmnet|ccmni|dummy|tun|v4-|pdp|wwan/i.test(nome);
        const roteador = /^(ap|swlan|softap|wlan|wigig|rndis|bt-pan|eth)/i.test(nome) && !movel;
        out.push({ ip: i.address, iface: nome, tipo: roteador ? "roteador" : movel ? "dados" : "outro" });
      }
  } catch (e) {}
  const ord = { roteador: 0, outro: 1, dados: 2 };
  out.sort((a, b) => ord[a.tipo] - ord[b.tipo]);
  endCache = { t: Date.now(), v: out };
  return out;
}

function clearTimers() { timers.forEach(clearTimeout); timers = []; }
const ctx = {
  now,
  nameOf,
  later(ms, fn) {
    const t = setTimeout(() => { timers = timers.filter((x) => x !== t); try { fn(); } catch (e) { console.error(e); } broadcast(); }, ms);
    timers.push(t);
    return t;
  },
  cancel(t) { clearTimeout(t); timers = timers.filter((x) => x !== t); },
  finish(resultado) { lastResult = resultado || null; },
  // quem está conectado agora (com 8s de tolerância) e há quanto tempo alguém caiu
  online(id) { const p = players.get(id); return !!p && online(p); },
  foraHa(id) { const p = players.get(id); if (!p) return 1e9; const d = now() - p.lastSeen; return d < 12000 ? 0 : d; },
};

// a cada 2s os jogos conferem se dá pra seguir sem quem caiu (ex.: todo mundo que está online já votou)
let assinatura = "";
setInterval(() => {
  const g = game && GAMES[game.key];
  let mudou = false;
  if (g && g.tick) { try { mudou = !!g.tick(game.st, ctx); } catch (e) { console.error(e); } }
  const sig = order.map((id) => (online(players.get(id)) ? 1 : 0)).join("");
  if (sig !== assinatura) { assinatura = sig; mudou = true; }
  if (mudou) broadcast();
}, 2000);

function ensureHost() {
  const h = players.get(hostId);
  if (h && online(h)) return;
  const next = order.map((id) => players.get(id)).find((p) => p && online(p));
  if (next) hostId = next.id;
}

function stateFor(pid) {
  ensureHost();
  const g = game && GAMES[game.key];
  let view = null;
  if (g) { try { view = g.view(game.st, pid, ctx); } catch (e) { console.error(e); view = { erro: String(e.message) }; } }
  return {
    now: now(),
    me: pid,
    hostId,
    players: order.map((id) => players.get(id)).filter(Boolean).map((p) => ({ id: p.id, name: p.name, online: online(p) })),
    jogos: Object.values(GAMES).sort((a, b) => (a.ordem || 9) - (b.ordem || 9)).map((g) => ({ key: g.key, nome: g.nome, emoji: g.emoji, desc: g.desc, min: g.min || 2, opcoes: g.opcoes || [] })),
    game: g ? { key: game.key, nome: g.nome, emoji: g.emoji, view } : null,
    enderecos: game ? undefined : enderecos().filter((e) => e.tipo !== "dados").map((e) => `http://${e.ip}:${PORT}`),
    lastResult,
  };
}

function send(res, pid) { try { res.write("data: " + JSON.stringify(stateFor(pid)) + "\n\n"); } catch (e) {} }
function broadcast() {
  for (const p of players.values()) for (const res of p.conns) send(res, p.id);
  for (const [res, id] of anon) { const p = players.get(id); if (p) { anon.delete(res); p.conns.add(res); } send(res, id); }
}

function act(pid, a) {
  const p = players.get(pid);
  if (a.type === "join") {
    const name = String(a.name || "").trim().slice(0, 16);
    if (!name) return "Digite um nome";
    // voltou? quem entra com o mesmo nome reassume o lugar (pontos, time, vez) — funciona até se o celular perdeu os dados
    const antigo = [...players.values()].find((x) => x.id !== pid && x.name.toLowerCase() === name.toLowerCase());
    if (antigo) { antigo.lastSeen = now(); return { pid: antigo.id }; }
    if (p) p.name = name;
    else { players.set(pid, { id: pid, name, conns: new Set(), lastSeen: now() }); order.push(pid); }
    if (!hostId) hostId = pid;
    return;
  }
  if (!p) return "Entre na sala primeiro";
  p.lastSeen = now();
  if (a.type === "leave") { for (const r of p.conns) anon.set(r, pid); players.delete(pid); order = order.filter((x) => x !== pid); if (hostId === pid) hostId = null; return; }
  if (a.type === "start") {
    const g = GAMES[a.key];
    if (!g) return "Jogo não existe";
    const list = order.map((id) => players.get(id)).filter((x) => x && online(x)).map((x) => ({ id: x.id, name: x.name }));
    if (list.length < (g.min || 2)) return `Precisa de pelo menos ${g.min || 2} jogadores`;
    clearTimers();
    lastResult = null;
    game = { key: g.key, st: g.init(list, a.opcoes || {}, ctx) };
    return;
  }
  if (a.type === "lobby") { clearTimers(); game = null; return; }
  if (a.type === "host") { hostId = pid; return; }
  if (!game) return "Nenhum jogo rolando";
  return GAMES[game.key].act(game.st, pid, a, ctx);
}

// ---------------- HTTP ----------------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/events") {
    const pid = String(u.searchParams.get("pid") || "");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    req.socket.setNoDelay(true); req.socket.setKeepAlive(true, 3000);
    res.write("retry: 1500\n\n");
    const p = players.get(pid);
    if (p) { p.conns.add(res); p.lastSeen = now(); } else anon.set(res, pid);
    send(res, pid);
    if (p) broadcast();
    const ka = setInterval(() => { try { res.write("event: ping\ndata: " + now() + "\n\n"); } catch (e) {} }, 4000);
    req.on("close", () => { clearInterval(ka); anon.delete(res); const q = players.get(pid); if (q) { q.conns.delete(res); q.lastSeen = now(); setTimeout(broadcast, 8500); } });
    return;
  }
  if (u.pathname === "/api/act" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => { body += d; if (body.length > 1e5) req.destroy(); });
    req.on("end", () => {
      let a = {};
      try { a = JSON.parse(body || "{}"); } catch (e) {}
      const pid = String(a.pid || "");
      if (a.type === "oi") { // batimento: só marca que está vivo (o broadcast sai pelo vigia abaixo se alguém voltou/caiu)
        const p = players.get(pid); if (p) p.lastSeen = now();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(p ? { ok: true } : { sumiu: true }));
      }
      let erro;
      try { erro = act(pid, a); } catch (e) { console.error(e); erro = "Erro: " + e.message; }
      // reconecta o canal do jogador recém-entrado
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(erro && typeof erro === "object" ? erro : erro ? { erro } : { ok: true }));
      broadcast();
    });
    return;
  }
  let f = u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname);
  const fp = path.join(PUB, path.normalize(f).replace(/^(\.\.[\/\\])+/, ""));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control": f.startsWith("/fotos/") ? "max-age=604800" : "no-cache" });
    res.end(d);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const ends = enderecos();
  console.log("\n  🎮  JOGOS DE VIAGEM rodando!\n");
  console.log("  Neste celular:   http://localhost:" + PORT);
  const bons = ends.filter((e) => e.tipo !== "dados");
  if (bons.length) bons.forEach((e) => console.log("  Para os amigos:  http://" + e.ip + ":" + PORT + (e.tipo === "roteador" ? "   <- roteador" : "")));
  else console.log("  Para os amigos:  ligue o ROTEADOR do celular e rode 'jogo' de novo");
  ends.filter((e) => e.tipo === "dados").forEach((e) => console.log("  (ignore " + e.ip + ": é a internet móvel)"));
  console.log("\n  Mais fácil: abra localhost:" + PORT + " aqui e mostre o QR code pros amigos.");
  console.log("  Deixe esta tela aberta. Para parar: Ctrl+C\n");
});

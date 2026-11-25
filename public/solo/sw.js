// Service worker do modo solo: guarda o jogo no celular pra abrir sem servidor e sem internet.
const V = "leilao-solo-v1";
const BASE = ["/solo/", "/solo/index.html", "/solo/engine.js", "/solo/leilao.bundle.js", "/solo/jogadores.json", "/solo/manifest.json", "/solo/icone.svg",
  "/app.js", "/style.css", "/capas/leilao.svg", "/fotos/_lista.json"];
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(BASE.map((u) => c.add(u).catch(() => {})));
    // fotos dos jogadores (as que já foram baixadas no celular do dono): guarda em segundo plano
    try { const l = await (await fetch("/fotos/_lista.json")).json(); for (const f of l) await c.add("/fotos/" + f).catch(() => {}); } catch (x) {}
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
})()));
// rede primeiro (pega a versão nova quando o servidor está ligado), cache se não tiver rede
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/events") || u.pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    const chave = u.pathname === "/solo" ? "/solo/" : u.pathname;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(e.request, { signal: ctl.signal }); clearTimeout(t);
      if (r.ok) c.put(chave, r.clone());
      return r;
    } catch (x) {
      const m = await c.match(chave) || (chave === "/solo/" && await c.match("/solo/index.html"));
      return m || new Response("", { status: 504 });
    }
  })());
});

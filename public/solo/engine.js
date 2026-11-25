// MODO SOLO: um "dono da sala" de mentirinha que roda dentro do próprio celular.
// Mesmo jogo do Leilão com os amigos (mesmo código), só que você + bots, sem rede nenhuma.
(function () {
  var EU = "eu";
  var nome = "Você";
  try { nome = localStorage.getItem("jv_nome") || "Você"; } catch (e) {}
  var game = null, lastResult = null, ouvinte = null, timers = new Set();
  var now = function () { return Date.now(); };
  function emitir() { if (ouvinte) ouvinte(estado()); }
  var ctx = {
    now: now,
    nameOf: function (id) { return id === EU ? nome : id; },
    later: function (ms, fn) {
      var t = setTimeout(function () { timers.delete(t); try { fn(); } catch (e) { console.error(e); } emitir(); }, ms);
      timers.add(t); return t;
    },
    cancel: function (t) { if (t) { clearTimeout(t); timers.delete(t); } },
    finish: function (r) { lastResult = r || null; },
    online: function (id) { return id === EU; },
    foraHa: function (id) { return id === EU ? 0 : 1e9; },
  };
  // bots e pausas que dependem de "quem está online" checam a cada 2s, igual no servidor
  setInterval(function () { if (game && window.LEILAO.tick) { try { if (window.LEILAO.tick(game.st, ctx)) emitir(); } catch (e) {} } }, 2000);
  function limpar() { timers.forEach(function (t) { clearTimeout(t); }); timers.clear(); }
  function estado() {
    var G = window.LEILAO, view = null;
    if (game) { try { view = G.view(game.st, EU, ctx); } catch (e) { console.error(e); view = { erro: String(e.message) }; } }
    return {
      solo: true, versao: "solo", now: now(), me: EU, hostId: EU,
      players: [{ id: EU, name: nome, online: true, visto: 0, net: null }],
      jogos: [{ key: G.key, nome: G.nome, emoji: G.emoji, desc: G.desc, min: 1, opcoes: G.opcoes || [] }],
      game: game ? { key: G.key, nome: G.nome, emoji: G.emoji, view: view } : null,
      lastResult: lastResult,
    };
  }
  function act(a) {
    var G = window.LEILAO, r;
    try {
      if (a.type === "nome") { nome = String(a.name || "Você").slice(0, 16); try { localStorage.setItem("jv_nome", nome); } catch (e) {} }
      else if (a.type === "start") { limpar(); lastResult = null; game = { st: G.init([{ id: EU, name: nome }], a.opcoes || {}, ctx) }; }
      else if (a.type === "lobby") { limpar(); game = null; }
      else if (game) r = G.act(game.st, EU, a, ctx);
    } catch (e) { console.error(e); r = "Erro: " + e.message; }
    emitir();
    return r && typeof r === "object" ? r : r ? { erro: r } : { ok: true };
  }
  function carregar(cb) {
    var j = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); };
    Promise.all([j("/solo/jogadores.json"), j("/fotos/_lista.json").catch(function () { return []; })]).then(function (res) {
      window.__DB = res[0]; window.__FOTOS = res[1];
      var s = document.createElement("script"); s.src = "/solo/leilao.bundle.js";
      s.onload = function () { cb(); }; s.onerror = function () { cb(new Error("bundle")); };
      document.head.appendChild(s);
    }).catch(function (e) { cb(e); });
  }
  window.SOLO = {
    start: function (fn) {
      ouvinte = fn;
      carregar(function (err) {
        if (err) { document.getElementById("app").innerHTML = '<div class="card center" style="margin:20px">Não consegui carregar o modo solo.<br><small class="muted">Abra uma vez com o jogo ligado (Termux) pra ele ficar salvo no celular.</small></div>'; return; }
        emitir();
      });
    },
    act: act,
  };
})();

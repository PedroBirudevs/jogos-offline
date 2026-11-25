(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let pid = null;
  try { pid = localStorage.getItem("jv_pid"); } catch (e) {}
  // o endereço da página guarda quem você é (?eu=...): se o navegador apagar os dados, o link ainda lembra
  try { const q = new URLSearchParams(location.search).get("eu"); if (q && !pid) pid = q; } catch (e) {}
  if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem("jv_pid", pid); } catch (e) {} }

  let S = null, off = 0, es = null;
  const local = {}; // estado só deste celular (rascunhos)

  // ---------- conexão que se recupera sozinha ----------
  // o celular troca de rede, apaga a tela, perde o Wi-Fi por uns segundos… o canal morre sem avisar.
  // Então: o servidor manda "ping" a cada 4s; se passar 10s sem nada, a gente reabre o canal.
  let ultimo = 0, tentativas = 0;
  function souEu(novo) {
    pid = novo; lastHTML = "";
    try { localStorage.setItem("jv_pid", pid); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set("eu", pid); history.replaceState(null, "", u); } catch (e) {}
  }
  function conectar() {
    if (es) { try { es.close(); } catch (e) {} }
    ultimo = Date.now();
    es = new EventSource("/events?pid=" + encodeURIComponent(pid));
    es.onopen = () => { tentativas = 0; ultimo = Date.now(); status(true); };
    es.onmessage = (e) => { ultimo = Date.now(); S = JSON.parse(e.data); off = S.now - Date.now(); status(true); render(); };
    es.addEventListener("ping", () => { ultimo = Date.now(); status(true); });
    // o dono da sala reconheceu este celular (mesmo aparelho de antes): volta pro lugar sem digitar nada
    es.addEventListener("voce", (e) => { try { const d = JSON.parse(e.data); if (d.pid && d.pid !== pid) { souEu(d.pid); toast("Bem-vindo de volta, " + d.nome + "! Você voltou pro seu lugar"); conectar(); } } catch (x) {} });
    es.onerror = () => { status(false); const a = $("#app"); if (!S && a) a.innerHTML = `<div class="center muted" style="padding:40px">Procurando o jogo… confira se está no Wi-Fi do dono da sala.</div>`; };
  }
  setInterval(() => {
    const parado = Date.now() - ultimo;
    if (parado > 6000) status(false);
    if (parado > 10000 || (es && es.readyState === 2)) { tentativas++; conectar(); }
  }, 2000);
  // batimento: diz pro dono da sala "ainda estou aqui" e mede a conexão (pro teste de conexão da sala)
  const NET = { ping: 0, hist: [], falhas: 0, quedas: 0 };
  const tipo = /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "PC";
  setInterval(async () => {
    if (!S || !me()) return;
    const t0 = performance.now();
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 3500);
      const media = NET.hist.length ? Math.round(NET.hist.reduce((s, x) => s + x, 0) / NET.hist.length) : 0;
      const r = await fetch("/api/act", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "oi", pid, net: { ping: NET.ping, media, falhas: NET.falhas, quedas: NET.quedas, ua: tipo } }) });
      clearTimeout(to);
      NET.ping = Math.round(performance.now() - t0); NET.hist.push(NET.ping); if (NET.hist.length > 15) NET.hist.shift();
      const j = await r.json(); if (j.sumiu) { lastHTML = ""; S.players = S.players.filter((p) => p.id !== pid); render(); }
    } catch (e) { NET.falhas++; }
  }, 4000);
  const reabrir = () => { if (Date.now() - ultimo > 3000) conectar(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) reabrir(); });
  window.addEventListener("online", reabrir);
  window.addEventListener("focus", reabrir);
  window.addEventListener("pageshow", reabrir);
  let ligado = true;
  function status(ok) {
    if (ok === ligado) return; ligado = ok;
    if (!ok) NET.quedas++;
    let b = document.getElementById("conn");
    if (!b) { b = document.createElement("div"); b.id = "conn"; document.body.appendChild(b); }
    b.className = ok ? "ok" : "off";
    b.textContent = ok ? "✅ Conectado de novo" : "📡 Sem sinal do dono da sala… reconectando sozinho";
    if (ok) {
      setTimeout(() => { if (ligado) b.className = "hide"; }, 1500);
      if (S && S.game && S.game.key === "stop" && document.getElementById("st0")) setTimeout(() => FN.stopIn && FN.stopIn(), 300);
    }
  }
  async function send(a) {
    try {
      const r = await fetch("/api/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, pid }) });
      const j = await r.json();
      if (j.erro) toast(j.erro);
      return j;
    } catch (e) { toast("Não chegou no dono da sala — confere o Wi-Fi e toca de novo"); reabrir(); return { erro: "rede" }; }
  }
  window.J = { send };
  let tt;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2200); }
  const agora = () => Date.now() + off;
  const seg = (fim) => Math.max(0, Math.ceil((fim - agora()) / 1000));
  const timerHTML = (fim, total) => `<div class="row" style="margin:8px 0"><div class="bar grow"><i data-fim="${fim}" data-total="${total || 0}"></i></div><b class="timer" data-fim="${fim}">${seg(fim)}s</b></div>`;
  setInterval(() => { const r = document.getElementById("roleta"); if (r) r.textContent = "ABCDEFGHIJLMNOPRSTUV"[Math.floor(Math.random() * 20)]; }, 90);
  setInterval(() => {
    document.querySelectorAll(".timer[data-fim]").forEach((el) => (el.textContent = seg(+el.dataset.fim) + "s"));
    // martelo do leiloeiro: "dou-lhe uma… duas… três!" + anel que esvazia
    document.querySelectorAll(".martelo[data-fim]").forEach((el) => {
      const rest = (+el.dataset.fim - agora()) / 1000, tot = +el.dataset.total || 5;
      const n = el.querySelector("b"), f = el.querySelector("small"), anel = el.querySelector("circle.a");
      if (n) n.textContent = String(Math.max(0, Math.ceil(rest))).padStart(2, "0");
      if (f) f.textContent = el.dataset.lider ? (rest > tot * 0.66 ? "Dou-lhe uma…" : rest > tot * 0.33 ? "Dou-lhe duas…" : "Dou-lhe três…") : "Quem dá mais?";
      if (anel) anel.style.strokeDashoffset = String(176 * (1 - Math.max(0, Math.min(1, rest / tot))));
      el.classList.toggle("urg", rest < 2);
    });
    document.querySelectorAll(".bar i[data-fim]").forEach((el) => { const t = +el.dataset.total; if (t) el.style.width = Math.max(0, Math.min(100, ((+el.dataset.fim - agora()) / t) * 100)) + "%"; });
  }, 250);

  const me = () => S && S.players.find((p) => p.id === pid);
  const CORES = ["#4cc3ff", "#ff6b2c", "#c6ff3d", "#ff5d9e", "#ffcf3f", "#9b7bff", "#3ddc84", "#ff5d6c", "#2ee6d6", "#f78fff"];
  const corDe = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };
  const av = (id, nomeP, tam) => `<span class="av" style="background:${corDe(id)};${tam ? `width:${tam}px;height:${tam}px;font-size:${tam * 0.42}px` : ""}">${esc(String(nomeP || "?").trim().slice(0, 1).toUpperCase())}</span>`;
  const nome = (id) => ((S && S.players.find((p) => p.id === id)) || {}).name || "?";

  // ---------- render com preservação de inputs ----------
  let lastHTML = "";
  function render() {
    const html = !me() ? telaEntrar() : S.game ? telaJogo() : telaSala();
    if (html === lastHTML) { HOOKS.length = 0; return; }
    const app = $("#app");
    const vals = {}; let foco = null, sel = null;
    app.querySelectorAll("input[id]").forEach((i) => { if (i.type !== "range" || i.dataset.keep) vals[i.id] = i.value; });
    if (document.activeElement && document.activeElement.id) { foco = document.activeElement.id; try { sel = [document.activeElement.selectionStart, document.activeElement.selectionEnd]; } catch (e) {} }
    app.innerHTML = html; lastHTML = html;
    for (const [id, v] of Object.entries(vals)) { const i = document.getElementById(id); if (i && !i.dataset.fresh) i.value = v; }
    if (foco) { const i = document.getElementById(foco); if (i) { i.focus(); try { if (sel) i.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    bind();
  }
  // liga eventos por data-a="{json}"
  function bind() {
    document.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => { const a = JSON.parse(b.dataset.a); if (a.confirm && !confirm(a.confirm)) return; delete a.confirm; send(a); }));
    document.querySelectorAll("[data-fn]").forEach((b) => (b.onclick = () => FN[b.dataset.fn](b)));
    document.querySelectorAll("[data-in]").forEach((i) => (i.oninput = () => FN[i.dataset.in](i)));
    document.querySelectorAll("[data-hold]").forEach((el) => { const on = (e) => { e.preventDefault(); el.classList.add("show"); }, off = () => el.classList.remove("show"); el.onpointerdown = on; el.onpointerup = off; el.onpointerleave = off; el.onpointercancel = off; el.oncontextmenu = (e) => e.preventDefault(); });
    const h = HOOKS.splice(0); h.forEach((f) => f());
    HOOKS_SEMPRE.forEach((f) => { try { f(); } catch (e) {} });
  }
  const HOOKS = [], HOOKS_SEMPRE = [];
  const A = (o) => esc(JSON.stringify(o));
  const FN = {};

  // ---------- Entrar ----------
  function telaEntrar() {
    return `<div class="top"><div class="logo">Jogos de <span>Viagem</span></div></div>
    <div class="card"><h2>Bora jogar! 🚗</h2><p class="muted">Todo mundo no mesmo Wi-Fi do celular do dono da sala. Não precisa de internet.</p>
    <label class="l" for="nomeIn">Seu nome</label><input id="nomeIn" maxlength="16" placeholder="Ex.: Biru" autocomplete="off" value="${esc((() => { try { return localStorage.getItem("jv_nome") || ""; } catch (e) { return ""; } })())}">
    <div style="margin-top:12px"><button class="btn full" data-fn="entrar">Entrar na sala</button></div></div>
    ${S && S.players.length ? `<div class="card"><div class="muted" style="margin-bottom:8px">${S.game ? "Caiu da sala? Toque no seu nome pra voltar pro seu lugar:" : "Já estão na sala (caiu? toque no seu nome):"}</div><div class="row">${S.players.map((p) => `<button class="pill ${p.online ? "" : "off"}" data-fn="souEu" data-n="${esc(p.name)}">${av(p.id, p.name, 22)} ${esc(p.name)}${p.online ? "" : " · caiu"}</button>`).join("")}</div></div>` : ""}`;
  }
  FN.aba = (b) => { local.aba = b.dataset.v; lastHTML = ""; render(); };
  FN.subSai = (b) => { local.subSai = +b.dataset.id; lastHTML = ""; render(); };
  FN.verJogo = (b) => { local.verJogo = +b.dataset.i; lastHTML = ""; render(); };
  FN.outroLance = () => { const el = $("#outroValor"); const n = Math.floor(+((el && el.value) || 0)); if (!n) return toast("Digite o valor do lance"); send({ type: "lance", valor: n }).then((r) => { if (!r.erro && el) el.value = ""; }); };
  FN.souEu = (b) => { $("#nomeIn").value = b.dataset.n; FN.entrar(); };
  FN.entrar = async () => {
    const n = $("#nomeIn").value.trim(); if (!n) return toast("Digite seu nome");
    try { localStorage.setItem("jv_nome", n); } catch (e) {}
    const r = await send({ type: "join", name: n });
    if (r.pid) { souEu(r.pid); toast("Bem-vindo de volta, " + (r.nome || n) + "! Você voltou pro seu lugar"); } else if (!r.erro) souEu(pid);
    if (!r.erro) { lastHTML = ""; conectar(); }
  };

  // ---------- Sala ----------
  function telaSala() {
    const lr = S.lastResult;
    return `<div class="top"><div class="logo">Jogos de <span>Viagem</span></div><button class="btn sm alt" data-fn="sair">Sair</button></div>
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>Na sala (${S.players.filter((p) => p.online).length})</b><small class="muted">👑 = dono da sala</small></div>
      <div class="row">${S.players.map((p) => `<span class="pill ${p.online ? "" : "off"} ${p.id === pid ? "me" : ""}">${av(p.id, p.name, 24)} ${p.id === S.hostId ? "👑 " : ""}${esc(p.name)}${p.online ? "" : ` <small class="muted">caiu</small>${S.hostId === pid ? ` <b style="cursor:pointer;color:var(--red)" data-a='${A({ type: "remover", alvo: p.id, confirm: "Tirar " + p.name + " da sala? (se voltar, entra de novo normal)" })}'>✕</b>` : ""}`}</span>`).join("")}</div>${S.players.some((p) => !p.online) ? `<p class="muted" style="margin:8px 0 0;font-size:13px">Quem caiu volta sozinho pro mesmo lugar quando abrir o jogo de novo no mesmo celular.</p>` : ""}</div>
    ${convite()}
    ${testeConexao()}
    <p class="center muted" style="font-size:12px;margin:4px 0 0">versão ${esc(S.versao || "?")}</p>
    ${lr ? `<div class="card"><h3 style="margin-bottom:8px">${esc(lr.titulo)}</h3><div class="list">${(lr.linhas || []).map((l, i) => `<div class="li"><span>${i + 1}. ${esc(l.nome)}</span><b>${esc(l.pontos)}</b></div>`).join("")}</div></div>` : ""}
    ${abasJogos()}`;
  }
  // ---------- Leilão em destaque, numa aba só dele; os outros jogos na outra ----------
  function abasJogos() {
    const aba = local.aba || "leilao";
    const L = S.jogos.find((g) => g.key === "leilao");
    const outros = S.jogos.filter((g) => g.key !== "leilao");
    const tabs = `<div class="abas"><button class="${aba === "leilao" ? "on" : ""}" data-fn="aba" data-v="leilao">⚽ Leilão OVER</button><button class="${aba === "outros" ? "on" : ""}" data-fn="aba" data-v="outros">🎲 Outros jogos</button></div>`;
    if (aba === "leilao" && L) return tabs + `<div class="hero-leilao">
        <div class="hl-top"><span class="hl-tag">MODO CARREIRA DE TÉCNICO</span><h2>Leilão <span>OVER</span></h2><p>R$ 100 no bolso. Jogadores reais, lance ao vivo, monte o time, escolha os reservas e jogue o campeonato ao vivo.</p></div>
        <div class="hl-feat"><div>🔨<b>Leilão</b><small>dou-lhe uma, duas…</small></div><div>🧩<b>Formação</b><small>troque na hora</small></div><div>🪑<b>Reservas</b><small>3 no banco</small></div><div>🏟️<b>Ao vivo</b><small>gás, cartão, lesão</small></div></div>
        <button class="btn huge full" data-fn="abrir" data-k="leilao">Criar leilão</button></div>`;
    return tabs + `<div class="games">${outros.map(cartaoJogo).join("")}</div>`;
  }
  function cartaoJogo(g) {
    return `<button class="game" data-fn="abrir" data-k="${g.key}"><img class="capa" src="/capas/${g.key}.svg" alt=""><div class="gi"><b>${g.emoji} ${esc(g.nome)}</b><small>${esc(g.desc)}</small><small class="minj">${g.min > 1 ? `mín. ${g.min} jogadores` : "dá pra jogar com bots"}</small></div></button>`;
  }
  // ---------- teste de conexão (fica na sala, atualiza a cada 4s) ----------
  function testeConexao() {
    const nota = (p) => {
      if (!p.online) return ["🔴", "caiu", "var(--red)"];
      const n = p.net; if (!n || !n.ping) return ["⚪", "medindo…", "var(--mut)"];
      if (n.quedas >= 3 || n.falhas >= 3 || n.media > 600) return ["🔴", "ruim", "var(--red)"];
      if (n.quedas >= 1 || n.falhas >= 1 || n.media > 250) return ["🟡", "instável", "#ffcf3f"];
      return ["🟢", "boa", "#3ddc84"];
    };
    const eu = S.players.find((p) => p.id === pid) || {};
    const [, minha] = nota(eu);
    const dica = minha === "ruim" || minha === "instável" ? `<p style="margin:8px 0 0;color:#ffcf3f"><b>Sua conexão está ${minha}.</b> Desliga os dados móveis, chega mais perto do dono da sala e, se for iPhone, deixa "Endereço Wi-Fi Privado" desativado nessa rede.</p>` : "";
    return `<details class="card" ${local.abrirTeste ? "open" : ""} id="testeBox"><summary style="cursor:pointer"><b>📶 Teste de conexão</b> <small class="muted">— toque pra ver</small></summary>
      <p class="muted" style="margin:8px 0">Deixa todo mundo nessa tela 1–2 minutos (até andando com o carro). Ping = tempo de resposta. Quedas = vezes que o celular perdeu o jogo.</p>
      <div class="list">${S.players.map((p) => { const [b, txt, cor] = nota(p), n = p.net || {}; return `<div class="li"><span>${b} ${esc(p.name)} <small class="muted">${esc(n.ua || "")}</small></span><span style="text-align:right"><b style="color:${cor}">${txt}</b><br><small class="muted">${p.online ? `ping ${n.media || n.ping || "–"} ms · quedas ${n.quedas || 0} · falhas ${n.falhas || 0}` : `sem sinal há ${p.visto}s`}</small></span></div>`; }).join("")}</div>
      ${dica}
      <p class="muted" style="margin:8px 0 0;font-size:13px">🟢 até ~250 ms e nenhuma queda · 🟡 caiu 1–2 vezes ou lento · 🔴 caindo direto: veja as dicas de Wi-Fi</p></details>`;
  }
  document.addEventListener("toggle", (e) => { if (e.target && e.target.id === "testeBox") local.abrirTeste = e.target.open; }, true);
  function convite() {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const url = local ? (S.enderecos || [])[0] : location.origin;
    if (!url) return `<div class="card convite"><b>📶 Chame a galera</b><p class="muted" style="margin:6px 0 0">Ligue o <b style="color:var(--txt)">roteador Wi-Fi</b> deste celular e rode <code>jogo</code> de novo no Termux. Aí aparece o QR code aqui.</p></div>`;
    HOOKS.push(() => { const el = document.getElementById("qr"); if (el && window.qrcode && el.dataset.u !== url) { const q = qrcode(0, "M"); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); el.dataset.u = url; } });
    return `<div class="card convite"><div class="qr" id="qr"></div><div><b>📶 Chame a galera</b><p class="muted" style="margin:6px 0">1. <b style="color:var(--txt)">Desliga os dados móveis</b><br>2. Conecta no Wi-Fi deste celular (se perguntar, "manter conectado")<br>3. Aponta a câmera pro QR code</p><div class="url">${esc(url.replace("http://", ""))}</div></div></div>`;
  }
  FN.sair = () => { if (confirm("Sair da sala?")) send({ type: "leave" }).then(() => { lastHTML = ""; conectar(); }); };
  FN.abrir = (b) => {
    const g = S.jogos.find((x) => x.key === b.dataset.k);
    const m = $("#modal");
    m.innerHTML = `<div class="sheet"><img class="capa-modal" src="/capas/${g.key}.svg" alt=""><div class="row" style="justify-content:space-between"><h2>${g.emoji} ${esc(g.nome)}</h2><button class="btn sm alt" id="mx">✕</button></div>
      <p class="muted">${esc(g.desc)}</p>
      ${g.opcoes.map((o) => `<label class="l">${esc(o.nome)}</label><select id="op_${o.id}">${o.valores.map((v) => `<option ${v == o.padrao ? "selected" : ""}>${v}</option>`).join("")}</select>`).join("")}
      <div style="margin-top:16px"><button class="btn full" id="mgo">Começar pra todo mundo</button></div></div>`;
    m.classList.remove("hide");
    $("#mx").onclick = () => m.classList.add("hide");
    m.onclick = (e) => { if (e.target === m) m.classList.add("hide"); };
    $("#mgo").onclick = async () => {
      const opcoes = {}; g.opcoes.forEach((o) => (opcoes[o.id] = $("#op_" + o.id).value));
      const r = await send({ type: "start", key: g.key, opcoes });
      if (!r.erro) m.classList.add("hide");
    };
  };

  // ---------- Jogo ----------
  function telaJogo() {
    const g = S.game, v = g.view || {};
    const corpo = (R[g.key] || (() => "<div class='card'>?</div>"))(v);
    return `<div class="tema-${g.key}"><div class="top topjogo" style="background-image:linear-gradient(90deg,rgba(16,16,20,.92),rgba(16,16,20,.55)),url(/capas/${g.key}.svg)"><div class="logo">${g.emoji} ${esc(g.nome)}</div><button class="btn sm alt" data-a='${A({ type: "lobby", confirm: "Encerrar o jogo pra todo mundo e voltar pra sala?" })}'>Sair</button></div>${corpo}</div>`;
  }
  const placarHTML = (pl, titulo) => `<div class="card"><b>${titulo || "Placar"}</b><div class="list" style="margin-top:8px">${pl.map((x, i) => `<div class="li ${x.id === pid ? "hl" : ""}"><span>${(x.pts > 0 && ["🥇", "🥈", "🥉"][i]) || i + 1 + "."} ${av(x.id, x.nome, 26)} ${esc(x.nome)}</span><b>${x.pts}</b></div>`).join("")}</div></div>`;
  const voltar = `<button class="btn full" data-a='${A({ type: "lobby" })}'>Voltar pra sala</button>`;
  const R = {};

  // ===== LEILÃO =====
  const brl = (n) => n + "M";
  const ini = (n) => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const tier = (o) => (o == null ? "silver" : o >= 75 ? "gold" : o >= 65 ? "silver" : "bronze");
  const nv = (x) => (x == null ? "?" : x); // nota escondida
  const LAB = { GOL: ["ELA", "MAN", "CHU", "REF", "VEL", "POS"], X: ["RIT", "CHU", "PAS", "DRI", "DEF", "FÍS"] };
  const cardHTML = (j) => {
    const lab = j.grupo === "GOL" ? LAB.GOL : LAB.X, vals = [j.pac, j.sho, j.pas, j.dri, j.def, j.phy];
    return `<div class="fut ${tier(j.ovr)}">
      <div class="fut-top"><div class="fut-l"><div class="fut-ovr">${nv(j.ovr)}</div><div class="fut-pos">${esc(j.pos)}</div>${(j.pos2 || []).length ? `<div class="fut-pos2">${esc(j.pos2.join(" "))}</div>` : ""}<div class="fut-flag">${j.flag}</div></div>
        <div class="fut-av">${j.foto ? `<img src="${j.foto}" alt="" onerror="this.remove()">` : ""}<span>${esc(ini(j.nome))}</span></div></div>
      <div class="fut-nome">${esc(j.nome)}</div>
      <div class="fut-clube">${esc(j.clube)}${j.liga ? " · " + esc(j.liga) : ""}</div>
      <div class="fut-st">${lab.map((l, i) => `<div><b>${nv(vals[i])}</b><span>${l}</span></div>`).join("")}</div>
      ${j.aprox && j.ovr != null ? `<div class="fut-aprox">overall aproximado</div>` : ""}</div>`;
  };
  const ORD = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };
  const posTxt = (j) => [j.pos, ...(j.pos2 || [])].join("/"); // ex.: MC/LD/VOL (Valverde)
  const faltaTxt = (f) => Object.entries(f).filter(([, n]) => n > 0).map(([g, n]) => `${n} ${g}`).join(", ");
  const teamHTML = (t, n) => `<div class="team ${t.id === pid ? "mine" : ""}"><div class="row" style="justify-content:space-between"><b>${t.bot ? "🤖 " : ""}${esc(t.nome)}${t.id === pid ? " (você)" : ""}</b><span class="tag">💵 R$ ${t.dinheiro}</span></div>
    <div class="muted" style="font-size:12px;margin:2px 0 4px">${t.elenco.length}/${n}${t.r ? ` · ATQ ${t.r.ataque} · DEF ${t.r.defesa} · GERAL ${t.r.geral}` : " · notas escondidas"}${faltaTxt(t.falta) ? ` · falta: ${faltaTxt(t.falta)}` : ""}</div>
    ${[...t.elenco].sort((a, b) => ORD[a.slot || a.grupo] - ORD[b.slot || b.grupo]).map((j) => `<div class="j"><span><span class="mini ${tier(j.ovr)}">${nv(j.ovr)}</span> ${j.foto ? `<img class="jf" src="${j.foto}" alt="" onerror="this.remove()">` : j.flag} ${esc(j.nome)} <small class="muted">${esc(posTxt(j))}${j.preco ? " · R$ " + j.preco : ""}</small></span></div>`).join("")}
    ${t.banco && t.banco.length ? `<div class="muted" style="font-size:12px;margin:6px 0 2px">🪑 Reservas</div>${t.banco.map((j) => `<div class="j" style="opacity:.8"><span><span class="mini ${tier(j.ovr)}">${nv(j.ovr)}</span> ${j.foto ? `<img class="jf" src="${j.foto}" alt="" onerror="this.remove()">` : j.flag} ${esc(j.nome)} <small class="muted">${esc(posTxt(j))}${j.preco ? " · R$ " + j.preco : ""}</small></span></div>`).join("")}` : ""}</div>`;
  const agrupa = (l) => { const c = {}; l.forEach((x) => (c[x.nome] = (c[x.nome] || 0) + 1)); return Object.entries(c).map(([n, k]) => esc(n) + (k > 1 ? " " + k : "")).join(", "); };
  const jogoHTML = (g, nomeT) => `<div class="jogo"><span class="t">${esc(nomeT(g.a))}</span><span class="placar">${g.ga} x ${g.gb}</span><span class="t r">${esc(nomeT(g.b))}</span></div>
    ${g.golsA.length || g.golsB.length || g.pen ? `<div class="gols">${g.golsA.length ? "⚽ " + agrupa(g.golsA) : ""}${g.golsA.length && g.golsB.length ? " · " : ""}${g.golsB.length ? "⚽ " + agrupa(g.golsB) : ""}${g.pen ? `<br>Pênaltis: ${g.pen[0]} x ${g.pen[1]}` : ""}</div>` : ""}`;
  const real = (n) => "R$ " + n;
  const chips = (campo, lista, atual) => `<div class="chips">${lista.map((x) => `<button class="chip ${x === atual ? "on" : ""}" data-a='${A({ type: "tatica", [campo]: x })}'>${esc(x)}</button>`).join("")}</div>`;
  const taticaHTML = (v, titulo) => v.minhaTatica ? `<div class="card"><b>${titulo || "Sua tática"}</b>
      <label class="l">Formação</label>${chips("form", v.esquemas, v.minhaTatica.form)}
      <label class="l">Estilo</label>${chips("estilo", v.estilos, v.minhaTatica.estilo)}
      <label class="l">Postura</label>${chips("postura", v.posturas, v.minhaTatica.postura)}</div>` : "";
  const tabelaHTML = (v) => v.tabela && v.etapa !== undefined && v.totalRodadas ? `<div class="card" style="padding:10px"><table><tr><th>#</th><th>Time</th><th class="n">P</th><th class="n">J</th><th class="n">V</th><th class="n">E</th><th class="n">D</th><th class="n">SG</th></tr>
      ${v.tabela.map((t, i) => `<tr style="${t.id === pid ? "color:var(--ac)" : ""}"><td>${i + 1}</td><td><b>${esc(t.nome)}</b></td><td class="n"><b>${t.pts}</b></td><td class="n">${t.j}</td><td class="n">${t.v}</td><td class="n">${t.e}</td><td class="n">${t.d}</td><td class="n">${t.sg}</td></tr>`).join("")}</table></div>` : "";
  const artHTML = (v) => v.artilharia && v.artilharia.length ? `<div class="card"><b>⚽ Artilharia</b><div class="list" style="margin-top:8px">${v.artilharia.map((a, i) => `<div class="li"><span>${i + 1}. ${esc(a.nome)} <small class="muted">${esc(a.time)}</small></span><b>${a.gols}</b></div>`).join("")}</div></div>` : "";
  // ---------- campinho (formação com as vagas) ----------
  const curto = (n) => { const p = String(n).split(/\s+/); return p.length > 1 ? p[p.length - 1] : p[0]; };
  function campinho(t, grande) {
    const f = t.form || { GOL: 1, DEF: 2, MEI: 1, ATA: 1 };
    const linha = (g) => {
      const js = t.elenco.filter((j) => (j.slot || j.grupo) === g);
      const vagas = Math.max(f[g] || 0, js.length);
      if (!vagas) return "";
      return `<div class="cl">${Array.from({ length: vagas }, (_, i) => {
        const j = js[i];
        if (!j) return `<div class="cs vazio"><i>+</i>${grande ? `<small>${g}</small>` : ""}</div>`;
        return `<div class="cs"><i class="${tier(j.ovr)}">${j.foto ? `<img src="${j.foto}" alt="" onerror="this.remove()">` : ""}<em>${esc(ini(j.nome))}</em></i>${grande ? `<small>${esc(curto(j.nome))}</small>` : ""}</div>`;
      }).join("")}</div>`;
    };
    return `<div class="campo ${grande ? "g" : ""}">${["ATA", "MEI", "DEF", "GOL"].map(linha).join("")}</div>`;
  }
  // ---------- estádio animado: os dois times em campo, bola andando, gás de cada um ----------
  const XS = { GOL: 6, DEF: 21, MEI: 34, ATA: 45 };
  function estadio(g, nomeT) {
    const lado = (L, s) => {
      const ativos = L.campo.filter((x) => !x.fora);
      const por = {}; ativos.forEach((x) => (por[x.slot] = por[x.slot] || []).push(x));
      // o time empurra um pouco na direção da bola quando está com ela
      const emp = (g.posse === s ? 1 : -1) * (s === "a" ? 1 : -1) * 3;
      return Object.entries(por).flatMap(([sl, xs]) => xs.map((x, i) => {
        const bx = XS[sl] + (sl === "GOL" ? 0 : emp), px = s === "a" ? bx : 100 - bx, py = ((i + 1) / (xs.length + 1)) * 100;
        const cor = x.est > 50 ? "#3ddc84" : x.est > 20 ? "#ffcf3f" : "#ff5d6c";
        return `<div class="tk ${s}" data-k="${g.a}${g.b}${x.id}" data-x="${px}" data-y="${py}" style="left:${px}%;top:${py}%"><i>${x.foto ? `<img src="${x.foto}" alt="">` : ""}<em>${esc(ini(x.nome))}</em>${x.am ? `<u class="am"></u>` : ""}</i><small>${esc(curto(x.nome))}</small><s><b style="width:${x.est}%;background:${cor}"></b></s></div>`;
      })).join("");
    };
    return `<div class="estadio"><div class="gramado"><div class="meio"></div><div class="area e"></div><div class="area d"></div>
      ${lado(g.A, "a")}${lado(g.B, "b")}
      <div class="bola" data-k="bola${g.a}${g.b}" data-x="${g.bola.x}" data-y="${g.bola.y}" style="left:${g.bola.x}%;top:${g.bola.y}%"></div></div>
      <div class="row muted" style="justify-content:space-between;font-size:12px;margin-top:4px"><span>⬅ ${esc(nomeT(g.a))} (${g.A.trocas}/${g.A.banco.length} trocas)</span><span>${esc(nomeT(g.b))} (${g.B.trocas}/${g.B.banco.length}) ➡</span></div></div>`;
  }
  // animação: cada elemento com data-k sai da posição anterior e desliza até a nova
  const POS = {};
  HOOKS_SEMPRE.push(() => {
    document.querySelectorAll(".estadio [data-k]").forEach((el) => {
      const k = el.dataset.k, x = +el.dataset.x, y = +el.dataset.y, p = POS[k];
      if (p && (p.x !== x || p.y !== y)) { el.style.transition = "none"; el.style.left = p.x + "%"; el.style.top = p.y + "%"; el.offsetWidth; el.style.transition = ""; el.style.left = x + "%"; el.style.top = y + "%"; }
      POS[k] = { x, y };
    });
  });
  function subsHTML(g) {
    const L = g.a === pid ? g.A : g.B;
    const livres = L.banco.filter((b) => !b.usado);
    if (!livres.length) return `<div class="card muted center" style="padding:8px">Sem trocas sobrando</div>`;
    const sai = local.subSai && L.campo.find((x) => x.id === local.subSai && !x.fora);
    return `<div class="card"><b>🔁 Substituição</b> <small class="muted">(${livres.length} no banco)</small>
      <div class="chips" style="margin-top:6px">${L.campo.filter((x) => !x.fora).map((x) => `<button class="chip ${sai && sai.id === x.id ? "on" : ""}" data-fn="subSai" data-id="${x.id}">${esc(curto(x.nome))} <small>${x.est}%</small></button>`).join("")}</div>
      ${sai ? `<div class="muted" style="font-size:13px;margin:6px 0 2px">Quem entra no lugar de ${esc(curto(sai.nome))}?</div><div class="chips">${livres.map((b) => `<button class="chip" data-a='${A({ type: "sub", sai: sai.id, entra: b.id })}'>${esc(curto(b.nome))} <small>${b.ovr} ${esc(b.pos)}${b.grupos.includes(sai.slot) ? " ✓" : ""}</small></button>`).join("")}</div>` : `<div class="muted" style="font-size:12px;margin-top:4px">Toque em quem sai.</div>`}</div>`;
  }
  const TAG = { lidera: "🔨 lidera", passou: "passou", completo: "✅ completo", ausente: "📵 ausente" };
  R.leilao = (v) => `<div class="tema100">${leilaoCorpo(v)}</div>`;
  function leilaoCorpo(v) {
    const nomeT = (id) => (v.times.find((t) => t.id === id) || {}).nome;
    const meu = v.times.find((t) => t.id === pid);
    const timesHTML = `<div class="list">${[...v.times].sort((a, b) => (a.id === pid ? -1 : b.id === pid ? 1 : 0)).map((t) => teamHTML(t, v.n)).join("")}</div>`;
    if (v.fase === "leilao" && v.lote) {
      const L = v.lote, j = L.j;
      const dur = L.lider ? Math.min(v.tempo, 5000) : v.tempo;
      let acoes = "";
      const podeTrocar = meu && !v.cheio && !v.precisoDessa && (v.esqOk || []).some((e) => { const [d, m, a] = e.split("-").map(Number); const f = { GOL: 1, DEF: d, MEI: m, ATA: a }; return meu.elenco.filter((x) => x.grupo === j.grupo).length < f[j.grupo]; });
      if (!meu) acoes = `<p class="muted center">Você está só assistindo</p>`;
      else if (L.vendido) acoes = "";
      else if (v.cheio) acoes = `<p class="muted center">Seu time está completo ✅</p>`;
      else if (!v.precisoDessa) acoes = `<p class="muted center" style="margin:4px 0">Sem vaga pra ${j.grupo} na sua formação.${podeTrocar ? ` <b style="color:var(--txt)">Troque a formação aí embaixo pra entrar na briga.</b>` : ""}</p>`;
      else if (L.lider === pid) acoes = `<div class="center"><b style="color:var(--ac);font-size:20px">Você está ganhando! 🔥</b></div>`;
      else {
        const min = L.lider ? L.preco + 1 : L.preco, max = Math.max(0, v.meuMax);
        const b = (txt, a, ok, cls) => `<button class="btn ${cls || ""}" data-a='${A({ type: "lance", ...a })}' ${ok ? "" : "disabled"}>${txt}</button>`;
        acoes = `${!L.lider ? `<button class="btn huge full" style="margin-bottom:8px" data-a='${A({ type: "lance", inc: 0 })}' ${max >= L.preco ? "" : "disabled"}>Pegar por ${real(L.preco)}</button>` : ""}
          <div class="lances">${(L.lider ? [1, 5, 10] : [5, 10]).map((i) => b("+" + i, { inc: i }, max >= L.preco + i)).join("")}${b(`Tudo<small>R$ ${max}</small>`, { tudo: 1 }, max >= min, "tudo")}</div>
          <div class="row" style="margin-top:8px;gap:6px"><input id="outroValor" type="number" inputmode="numeric" min="${min}" max="${max}" placeholder="Outro valor" style="flex:1;min-width:0"><button class="btn alt" data-fn="outroLance">Dar lance</button></div>`;
      }
      if (meu && !v.cheio && !L.vendido && L.lider !== pid && v.precisoDessa) acoes += `<button class="btn alt full" style="margin-top:8px" data-a='${A({ type: "passar" })}' ${L.passei ? "disabled" : ""}>${L.passei ? "Você passou" : "Passar"}</button>`;
      const outros = [...v.times].filter((t) => t.id !== pid);
      const esqChips = meu && !v.cheio ? `<div class="chips" style="margin-top:8px">${v.esquemas.map((e) => `<button class="chip ${e === meu.esq ? "on" : ""}" data-a='${A({ type: "formacao", esq: e })}' ${(v.esqOk || []).includes(e) ? "" : "disabled"}>${e.replace(/-/g, "-")}${v.apelidos[e] ? `<small> ${esc(v.apelidos[e])}</small>` : ""}</button>`).join("")}</div>` : "";
      return `<div class="row muted" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><b style="color:var(--txt)">Jogador ${v.numLote} de ${v.totalLotes}</b><span>💵 R$ 100 · ${esc(v.base)}${v.oculto ? " · 🙈 notas escondidas" : ""}</span></div>
        <div class="card lote">
          ${L.vendido ? `<div class="center" style="font-size:22px;font-weight:900;margin:4px 0 8px">${L.lider ? `🔨 VENDIDO para ${esc(L.liderNome)}` : "Ninguém quis 🤷"}</div>` : `<div class="martelo" data-fim="${L.fim}" data-total="${dur / 1000}" ${L.lider ? 'data-lider="1"' : ""}><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><circle class="a" cx="32" cy="32" r="28" style="stroke-dashoffset:${(176 * (1 - Math.max(0, Math.min(1, (L.fim - agora()) / dur)))).toFixed(1)}"/></svg><b>${String(seg(L.fim)).padStart(2, "0")}</b><small>${(() => { const r = (L.fim - agora()) / 1000, t = dur / 1000; return L.lider ? (r > t * 0.66 ? "Dou-lhe uma…" : r > t * 0.33 ? "Dou-lhe duas…" : "Dou-lhe três…") : "Quem dá mais?"; })()}</small></div>`}
          ${cardHTML(j)}
          <div class="center" style="margin-top:8px">
            <div class="muted">${L.lider ? `<b style="color:var(--txt)">${esc(L.liderNome)}</b> ${L.vendido ? "levou" : "lidera"}` : L.vendido ? "" : "Lance inicial"}</div>
            <div class="preco">${L.vendido && !L.lider ? "—" : real(L.preco)}</div>
            ${L.hist.length > 1 ? `<div class="hist">${L.hist.slice(1).map((h) => `<div><span>${esc(h.nome)}</span><span>R$ ${h.valor}</span></div>`).join("")}</div>` : ""}
          </div>
          <div style="margin-top:10px">${acoes}</div>
        </div>
        ${meu ? `<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(meu.nome)} (você)</b><span class="tag">💵 R$ ${meu.dinheiro}</span></div>
          <div class="muted" style="font-size:12px;margin:2px 0 8px">${v.cheio ? `Time fechado ✅ · sobrou R$ ${meu.dinheiro}` : `lance máx. ${real(Math.max(0, v.meuMax))} · o que sobrar no fim não vale nada!`}</div>
          ${campinho(meu, true)}${esqChips}</div>` : ""}
        ${v.log.length ? `<div class="card"><div class="list">${v.log.map((l) => `<div class="muted" style="font-size:14px">• ${esc(l)}</div>`).join("")}</div></div>` : ""}
        <div class="campos">${outros.map((t) => `<div class="mini-time ${t.tag === "lidera" ? "lid" : ""}"><div class="row" style="justify-content:space-between;gap:4px"><b>${t.bot ? "🤖 " : ""}${esc(t.nome)}</b><small>R$ ${t.dinheiro}</small></div>${t.tag ? `<span class="tg ${t.tag}">${TAG[t.tag]}</span>` : `<span class="tg vz"> </span>`}${campinho(t, false)}</div>`).join("")}</div>`;
    }
    if (v.fase === "reservas") {
      const Rr = v.res, NOMES = { DEF: "🛡️ Defensor", MEI: "🎯 Meio-campo", ATA: "⚡ Atacante" };
      local.resLance = local.resLance || {};
      const todos = Rr.preciso.every((g) => Rr.minhas[g]);
      const blocos = ["DEF", "MEI", "ATA"].map((g) => {
        const ja = meu && (meu.banco || []).find((j) => (j.slot || j.grupo) === g);
        if (!meu) return "";
        if (ja) return `<div class="card"><b>${NOMES[g]}</b><div class="muted" style="margin-top:4px">✅ Seu reserva: <b style="color:var(--txt)">${esc(ja.nome)}</b> (${ja.ovr})</div></div>`;
        const esc1 = Rr.minhas[g], lance = esc1 ? esc1.lance : local.resLance[g] || 0;
        return `<div class="card"><div class="row" style="justify-content:space-between"><b>${NOMES[g]}</b><span class="muted" style="font-size:13px">seu lance: <b style="color:var(--txt)">R$ ${lance}</b></span></div>
          <div class="resl">${Rr.cands[g].map((c) => `<button class="resc ${esc1 && esc1.id === c.id ? "on" : ""}" data-a='${A({ type: "reserva", g, id: c.id, lance })}'><i class="${tier(c.ovr)}">${c.foto ? `<img src="${c.foto}" alt="" onerror="this.remove()">` : ""}<em>${esc(ini(c.nome))}</em></i><b>${c.ovr}</b><span>${esc(curto(c.nome))}</span><small>${esc(posTxt(c))}</small></button>`).join("") || `<p class="muted">Acabou a lista — você ganha um no fim.</p>`}</div>
          ${esc1 ? `<div class="row" style="gap:6px;margin-top:8px"><span class="muted" style="font-size:13px">Lance (se outro quiser o mesmo):</span>${[0, 1, 5, 10].map((x) => `<button class="chip ${lance === x ? "on" : ""}" data-a='${A({ type: "reserva", g, id: esc1.id, lance: x })}' ${x > meu.dinheiro ? "disabled" : ""}>R$ ${x}</button>`).join("")}</div>` : ""}</div>`;
      }).join("");
      return `<div class="card center"><h2>🪑 Escolha seus reservas</h2><p class="muted" style="margin:6px 0">1 de cada: defensor, meio e atacante (82–86). Toque no que quer. Se mais de um escolher o mesmo, leva quem deu o maior lance com o dinheiro que sobrou — quem perder escolhe de novo.</p>
          <div class="row" style="justify-content:center;gap:12px"><span class="tag">💵 R$ ${meu ? meu.dinheiro : 0}</span><span>Rodada ${Rr.rodada} · ⏱ <b class="timer" data-fim="${Rr.fim}">${seg(Rr.fim)}s</b></span></div></div>
        ${blocos}
        ${meu && Rr.preciso.length ? `<button class="btn full ${Rr.pronto ? "alt" : "green"}" data-a='${A({ type: "reservaPronto" })}' ${todos && !Rr.pronto ? "" : "disabled"}>${Rr.pronto ? "Esperando os outros…" : todos ? "✅ Confirmar escolhas" : "Escolha 1 de cada que falta"}</button>` : ""}
        ${Rr.esperando.length ? `<p class="center muted">Esperando: ${Rr.esperando.map(esc).join(", ")}</p>` : ""}
        ${Rr.log.length ? `<div class="card"><div class="list">${Rr.log.map((l) => `<div class="muted" style="font-size:14px">• ${esc(l)}</div>`).join("")}</div></div>` : ""}`;
    }
    if (v.fase === "times") {
      return `<div class="card center"><h2>Elencos fechados! ⚽</h2><p class="muted">Formato: <b style="color:var(--txt)">${esc(v.formato)}</b>. Partidas ao vivo: tática muda na hora, jogador cansa (troca obrigatória abaixo de 20% de gás), pode machucar ou ser expulso (só naquele jogo).</p>
        <button class="btn full" data-a='${A({ type: "comecar" })}'>Começar campeonato</button></div>${taticaHTML(v, "Tática inicial")}` + timesHTML;
    }
    if (v.fase === "aovivo") {
      const meuJ = v.jogos.find((g) => g.a === pid || g.b === pid);
      const verJ = meuJ || v.jogos[local.verJogo || 0] || v.jogos[0];
      const minTxt = v.min > 90 ? `${v.min}' · gol de ouro` : v.min > 0 ? `${Math.min(v.min, 90)}'` : "Vai começar…";
      let h = `<div class="placarao"><div class="pt"><b>${esc(nomeT(verJ.a))}</b></div><div class="pc"><div class="ns">${verJ.ga}<span>x</span>${verJ.gb}</div><div class="mn"><span class="ao-vivo">●</span> ${v.intervalo ? "INTERVALO" : verJ.fim ? "FIM" : minTxt}</div></div><div class="pt r"><b>${esc(nomeT(verJ.b))}</b></div></div>`;
      // gol: tela de comemoração com a foto (2,5s)
      const ug = verJ.ev.find((e) => e.gol);
      if (ug) { const k = ug.m + ug.t; if (local.golK !== k) { local.golK = k; local.golAt = Date.now(); setTimeout(() => { lastHTML = ""; render(); }, 2700); } }
      if (ug && Date.now() - (local.golAt || 0) < 2600) h += `<div class="golao"><div class="gf">${ug.foto ? `<img src="${ug.foto}" alt="">` : `<em>${esc(ini(ug.autor || "?"))}</em>`}</div><div class="gt">GOOOL!</div><div class="gn">${esc(ug.autor || "")}</div><div class="muted">${esc(ug.time || "")} · ${esc(ug.placar || "")}</div></div>`;
      // pausa pra troca obrigatória
      if (v.pausa) {
        const P = v.pausa;
        if (P.tid === pid) h += `<div class="card pausa"><b>⏸ Troca obrigatória!</b><p style="margin:6px 0">${esc(P.sai.nome)} ${P.motivo === "machucado" ? "se machucou 🚑" : `está sem gás (${P.sai.est}%) 🥵`}. Quem entra? <span class="muted">(<b class="timer" data-fim="${P.fim}">${seg(P.fim)}s</b>, senão o técnico escolhe)</span></p>
          <div class="resl">${P.opcoes.map((o) => `<button class="resc" data-a='${A({ type: "sub", sai: P.sai.id, entra: o.id })}'><i class="${tier(o.ovr)}">${o.foto ? `<img src="${o.foto}" alt="">` : ""}<em>${esc(ini(o.nome))}</em></i><b>${o.ovr}</b><span>${esc(curto(o.nome))}</span><small>${esc(o.pos)}${o.grupos.includes(P.sai.slot) ? " ✓" : ""}</small></button>`).join("")}</div></div>`;
        else h += `<div class="card center muted">⏸ ${esc(P.nome)} está fazendo uma substituição… (<b class="timer" data-fim="${P.fim}">${seg(P.fim)}s</b>)</div>`;
      }
      if (v.intervalo) h += `<div class="card center"><b>⏸ Intervalo</b> — 2º tempo em <b class="timer" data-fim="${v.intervalo}">${seg(v.intervalo)}s</b><p class="muted" style="margin:4px 0">Dá pra trocar jogador e mudar a tática agora.</p>${meuJ ? `<button class="btn ${v.prontoIntervalo ? "alt" : ""} full" data-a='${A({ type: "segundoTempo" })}' ${v.prontoIntervalo ? "disabled" : ""}>${v.prontoIntervalo ? "Esperando os outros…" : "Pronto pro 2º tempo"}</button>` : ""}</div>`;
      h += estadio(verJ, nomeT);
      if (meuJ && !meuJ.fim) h += subsHTML(meuJ);
      h += `<div class="card relato"><b>🎙️ Relato</b><div class="ev">${verJ.ev.slice(0, 14).map((e) => `<div class="${e.tipo || ""}"><b>${e.m}'</b> ${esc(e.t)}</div>`).join("")}</div></div>`;
      if (meuJ && !meuJ.fim) h += taticaHTML(v, "Mude a tática agora");
      const outros = v.jogos.filter((g) => g !== verJ);
      if (outros.length) h += `<div class="card"><b>Outros jogos</b><div style="margin-top:8px">${outros.map((g) => `<div class="jogo" ${meuJ ? "" : `data-fn="verJogo" data-i="${v.jogos.indexOf(g)}"`}><span class="t">${esc(nomeT(g.a))}</span><span class="placar">${g.ga} x ${g.gb}${g.pen ? `<small> (${g.pen[0]}x${g.pen[1]})</small>` : ""}</span><span class="t r">${esc(nomeT(g.b))}</span></div>${g.ev[0] && g.ev[0].tipo !== "falta" ? `<div class="gols">${g.ev[0].m}' ${esc(g.ev[0].t)}</div>` : ""}`).join("")}</div></div>`;
      return h + tabelaHTML(v);
    }
    if (v.fase === "intervalo") {
      return `<div class="card"><h2>${esc(v.titulo)} — resultados</h2><div style="margin-top:10px">${v.jogos.map((g) => `<div class="jogo"><span class="t">${esc(nomeT(g.a))}</span><span class="placar">${g.ga} x ${g.gb}${g.pen ? `<small> (${g.pen[0]}x${g.pen[1]})</small>` : ""}</span><span class="t r">${esc(nomeT(g.b))}</span></div>${g.prorr && !g.pen ? `<div class="gols">⚡ decidido no gol de ouro</div>` : ""}`).join("")}</div>
        <button class="btn full" data-a='${A({ type: "proxima" })}'>${esc(v.proxTxt || "Próxima rodada")}</button></div>${taticaHTML(v, "Tática pro próximo jogo")}${tabelaHTML(v)}${artHTML(v)}`;
    }
    if (v.fase === "fim") {
      const gm = v.gastouMelhor || [];
      return `<div class="card center" style="border-color:var(--ac)"><div style="font-size:56px">🏆</div><h2 style="font-size:28px;color:var(--ac)">${esc(nomeT(v.campeao))} é CAMPEÃO!</h2></div>
        ${gm.length ? `<div class="card"><b>🏅 Taça de quem gastou melhor</b><p class="muted" style="margin:4px 0 8px">Mais força de time por real gasto</p><div class="list">${gm.map((x, i) => `<div class="li ${x.id === pid ? "hl" : ""}"><span>${["🥇", "🥈", "🥉"][i]} ${esc(x.nome)}</span><small>OVR ${x.geral} · gastou ${real(x.gasto)}</small></div>`).join("")}</div></div>` : ""}
        ${artHTML(v)}${tabelaHTML(v)}${voltar}<div style="margin-top:12px">${timesHTML}</div>`;
    }
    return `<div class="card">Carregando…</div>`;
  }

  // ===== SINTONIA =====
  function dialSVG(alvo, agulha, chutes, revela) {
    const ang = (v) => Math.PI - (v / 100) * Math.PI; // 0 = esquerda, 100 = direita
    const pt = (v, r) => [200 + r * Math.cos(ang(v)), 200 - r * Math.sin(ang(v))];
    const fatia = (a, b, cor) => { const [x1, y1] = pt(Math.max(0, a), 180), [x2, y2] = pt(Math.min(100, b), 180); return `<path d="M200 200 L${x1} ${y1} A180 180 0 0 1 ${x2} ${y2} Z" fill="${cor}"/>`; };
    let zonas = "";
    if (alvo !== null && alvo !== undefined) zonas = fatia(alvo - 15, alvo + 15, "#ffcf3f55") + fatia(alvo - 9, alvo + 9, "#ff6b2c99") + fatia(alvo - 4, alvo + 4, "#c6ff3d");
    const marcas = (chutes || []).filter((c) => c.v !== null && c.v !== undefined).map((c) => { const [x, y] = pt(c.v, 150); return `<circle cx="${x}" cy="${y}" r="9" fill="${c.cor || "#4cc3ff"}" stroke="#111" stroke-width="2" ${c.ok === false ? 'opacity=".55"' : ""}/><text x="${x}" y="${y - 14}" fill="#fff" font-size="13" font-weight="800" text-anchor="middle">${esc(c.nome.slice(0, 8))}${c.ok ? " ✓" : ""}</text>`; }).join("");
    const rot = agulha === null || agulha === undefined ? -90 : (agulha / 100) * 180 - 90;
    return `<svg class="dial" viewBox="0 0 400 215"><path d="M20 200 A180 180 0 0 1 380 200 Z" fill="#24242d" stroke="#33333e" stroke-width="2"/>${zonas}${marcas}
      ${agulha === null || agulha === undefined ? "" : `<g class="needle" style="transform:rotate(${rot}deg)"><line x1="200" y1="200" x2="200" y2="40" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>`}
      <circle cx="200" cy="200" r="12" fill="#fff"/></svg>`;
  }
  let movT = 0;
  FN.slider = (i) => { local.sint = +i.value; const g = document.querySelector(".needle"); if (g) g.style.transform = `rotate(${(i.value / 100) * 180 - 90}deg)`; const t = Date.now(); if (t - movT > 180) { movT = t; send({ type: "mover", valor: +i.value }); } };
  R.sintonia = (v) => {
    const spec = `<div class="spec"><span>⬅ ${esc(v.carta[0])}</span><span>${esc(v.carta[1])} ➡</span></div>`;
    const head = `<div class="row muted" style="justify-content:space-between;margin-bottom:8px"><span>Rodada ${v.rodada}/${v.total}</span><span>Quem dá a dica: <b style="color:var(--txt)">${esc(v.videnteNome)}</b></span></div>`;
    if (v.fase === "fim") return placarHTML(v.placar, "🎯 Resultado final") + voltar;
    if (v.fase === "girar") {
      if (v.souVidente) return head + `<div class="card center">${spec}${dialSVG(null, null)}<p>Sua vez! Gire a roleta. Só você vai ver onde parou.</p>
        <button class="btn huge full" data-a='${A({ type: "girar" })}'>🎡 Girar roleta</button><button class="btn alt sm" style="margin-top:8px" data-a='${A({ type: "trocar" })}'>Trocar tema</button></div>` + placarHTML(v.placar);
      return head + `<div class="card center">${spec}${dialSVG(null, null)}<p class="muted">${esc(v.videnteNome)} está girando a roleta…</p></div>` + placarHTML(v.placar);
    }
    if (v.fase === "dica") {
      if (v.souVidente) {
        const primeira = local.girou !== v.rodada;
        if (primeira) { local.girou = v.rodada; HOOKS.push(() => setTimeout(() => { const n = document.querySelector(".needle"); if (n) n.style.transform = `rotate(${(v.alvo / 100) * 180 - 90}deg)`; }, 80)); }
        return head + `<div class="card">${spec}${dialSVG(v.alvo, primeira ? 0 : v.alvo, null)}
          <p class="center muted">Parou no <b style="color:var(--txt)">${v.alvo}</b>. Dê uma dica que leve a galera até aí (pode falar em voz alta também).</p>
          <input id="dicaIn" maxlength="60" placeholder="Ex.: Pastel de feira" autocomplete="off"><div style="margin-top:8px"><button class="btn full" data-fn="enviarDica">Mandar dica</button></div>
          <button class="btn alt sm" style="margin-top:8px" data-a='${A({ type: "trocar" })}'>Trocar tema</button></div>`;
      }
      return head + `<div class="card center">${spec}${dialSVG(null, null)}<p class="muted">${esc(v.videnteNome)} está pensando na dica… 🤔</p></div>`;
    }
    if (v.fase === "chute") {
      if (v.souVidente || !v.jogando) return head + `<div class="card center">${spec}<h2 style="margin:10px 0">“${esc(v.dica)}”</h2>${dialSVG(v.souVidente ? v.alvo : null, null, (v.ao_vivo || []).map((c) => ({ ...c, cor: v.cores[c.id] })))}<p class="muted">${v.enviaram}/${v.precisam} chutaram</p>
        <button class="btn alt sm" data-a='${A({ type: "revelar" })}'>Revelar agora</button></div>`;
      const val = v.meuChute ?? local.sint ?? 50;
      const outros = []; // cada um chuta sozinho
      return head + `<div class="card">${spec}<h2 class="center" style="margin:10px 0">“${esc(v.dica)}”</h2>${dialSVG(null, val, outros)}
        <input type="range" id="sintR" min="0" max="100" value="${val}" data-in="slider">
        <button class="btn full" data-fn="chutar">${v.meuChute !== undefined ? "Mudar chute" : "Confirmar chute"}</button>
        <p class="muted center">${v.meuChute !== undefined ? "Chute enviado ✅ · " : ""}${v.enviaram}/${v.precisam} chutaram</p></div>`;
    }
    if (v.fase === "revela") {
      return head + `<div class="card">${spec}<h2 class="center" style="margin:10px 0">“${esc(v.dica)}”</h2>${dialSVG(v.alvo, v.alvo, v.chutes.map((c) => ({ ...c, cor: v.cores[(v.placar.find((p) => p.nome === c.nome) || {}).id] })), true)}
        <div class="list">${v.chutes.map((c) => `<div class="li"><span>${esc(c.nome)} chutou ${c.v}</span><b>+${c.g}</b></div>`).join("")}
        <div class="li"><span>${esc(v.videnteNome)} (dica)</span><b>+${v.ganhoVidente}</b></div></div>
        <button class="btn full" style="margin-top:10px" data-a='${A({ type: "proxima" })}'>${v.rodada >= v.total ? "Ver resultado" : "Próxima rodada"}</button></div>` + placarHTML(v.placar);
    }
    return "";
  };
  FN.enviarDica = () => { const d = $("#dicaIn").value.trim(); if (!d) return toast("Escreva a dica"); send({ type: "dica", dica: d }); };
  FN.chutar = () => { const r = $("#sintR"); send({ type: "chute", valor: +r.value }); };

  // ===== IMPOSTOR =====
  R.impostor = (v) => {
    if (v.fase === "encerrado") return placarHTML(v.placar, "🕵️ Resultado") + voltar;
    if (!v.jogando) return `<div class="card center muted">Rodada em andamento. Você entra na próxima partida.</div>`;
    if (v.fase === "palavra") {
      const segredo = v.souImp ? `<div class="secret imp">VOCÊ É O<br>IMPOSTOR 🤫</div>${v.cat ? `<p class="muted" style="margin:8px 0 2px">Tema: <b style="color:var(--txt)">${esc(v.cat)}</b></p>` : ""}${v.pista ? `<p style="margin:2px 0">Dica: <b style="color:var(--ac);font-size:20px">${esc(v.pista)}</b></p>` : ""}<p class="muted" style="margin:4px 0">Finja que sabe a palavra!</p>` : `<div class="secret">${esc(v.palavra)}</div><p class="muted">Categoria: ${esc(v.cat)}</p>`;
      return `<div class="card center"><div class="muted">Rodada ${v.rodada}</div>
        <div class="hold" data-hold="1"><div class="frente"><div style="font-size:54px">🃏</div><b>SEGURE PRA VER</b><small class="muted">esconda a tela dos outros</small></div><div class="verso">${segredo}</div></div></div>
        <div class="card"><b>Como jogar</b><p class="muted" style="margin:6px 0">Começando por <b style="color:var(--txt)">${esc(v.comeca)}</b>, cada um fala UMA palavra relacionada, sem entregar demais. Deem 1 ou 2 voltas e depois votem.</p>
        <button class="btn full" data-a='${A({ type: "votacao" })}'>Ir pra votação</button></div>` + placarHTML(v.placar);
    }
    if (v.fase === "votacao") {
      return `<div class="card"><h2>Quem é o impostor?</h2><p class="muted">${v.votaram}/${v.jogadores.length} votaram</p>
        <div class="vote">${v.jogadores.filter((j) => j.id !== pid).map((j) => `<button class="btn alt ${v.meuVoto === j.id ? "sel" : ""}" data-a='${A({ type: "voto", alvo: j.id })}'>${av(j.id, j.nome, 28)} ${esc(j.nome)}${j.votou ? " ✓" : ""}</button>`).join("")}</div>
        <button class="btn sm alt" style="margin-top:10px" data-a='${A({ type: "apurar" })}'>Apurar agora</button></div>`;
    }
    if (v.fase === "chuteImpostor") {
      return `<div class="card center"><h2>Pegaram ${esc(v.eliminado)}! 🎯</h2><p>Mas o impostor ainda pode ganhar se acertar a palavra.</p>
        ${v.souImp ? `<input id="chuteImp" placeholder="Qual era a palavra?" autocomplete="off"><div style="margin-top:8px"><button class="btn full" data-fn="chuteImp">Chutar</button></div>` : `<p class="muted">Esperando o impostor chutar…</p>`}</div>`;
    }
    if (v.fase === "fim") {
      const ganhei = (v.venc === "impostor") === v.souImp;
      return `<div class="card center"><div style="font-size:50px">${ganhei ? "🎉" : "😵"}</div><h2>${v.venc === "impostor" ? "Impostor venceu!" : "Vocês acharam o impostor!"}</h2>
        <p class="muted">${esc(v.motivo)}</p><p>Impostor: <b>${v.impostores.map(esc).join(", ")}</b><br>Palavra: <b>${esc(v.palavra)}</b> <span class="muted">(${esc(v.cat)})</span>${v.pista ? `<br><small class="muted">dica do impostor: ${esc(v.pista)}</small>` : ""}</p>
        <div class="list" style="text-align:left;margin-bottom:10px">${v.jogadores.map((j) => `<div class="li"><span>${av(j.id, j.nome, 24)} ${esc(j.nome)}${v.impostores.includes(j.nome) ? " 🤫" : ""}</span><span class="votobar"><i style="width:${(j.votos || 0) * 22}px"></i><b>${j.votos || 0}</b></span></div>`).join("")}</div>
        <div class="row"><button class="btn grow" data-a='${A({ type: "proxima" })}'>Nova rodada</button><button class="btn alt grow" data-a='${A({ type: "encerrar" })}'>Encerrar</button></div></div>` + placarHTML(v.placar);
    }
    return "";
  };

  FN.chuteImp = () => send({ type: "chute", texto: $("#chuteImp").value });

  // ===== TABU =====
  R.tabu = (v) => {
    const times = `<div class="card"><div class="row" style="justify-content:space-around;text-align:center">
      <div><div class="teamA" style="font-weight:900">TIME A</div><div style="font-size:34px;font-weight:900">${v.placar.A}</div><small class="muted">${v.A.map(esc).join(", ")}</small></div>
      <div><div class="teamB" style="font-weight:900">TIME B</div><div style="font-size:34px;font-weight:900">${v.placar.B}</div><small class="muted">${v.B.map(esc).join(", ")}</small></div></div>
      ${v.meuTime ? `<p class="center muted" style="margin:8px 0 0">Você é do <b class="team${v.meuTime}">Time ${v.meuTime}</b></p>` : ""}</div>`;
    const lista = v.lista.length ? `<div class="card"><div class="row">${v.lista.map((x) => `<span class="pill">${x.r} ${esc(x.p)}</span>`).join("")}</div></div>` : "";
    if (v.fase === "fim") return times + voltar;
    if (v.fase === "pronto") {
      return `<div class="card center"><div class="muted">Vez ${v.vez}/${v.total}</div><h2 style="margin:8px 0">${v.souExp ? "Sua vez de explicar! 🗣️" : `${esc(v.expNome)} vai explicar`}</h2>
        <p class="muted">Time <b class="team${v.timeExp}">${v.timeExp}</b> adivinha. ${v.fiscal ? "Você é fiscal: se ele falar uma palavra proibida, aperte o botão!" : ""}</p>
        ${v.souExp ? `<button class="btn huge full" data-a='${A({ type: "comecar" })}'>Começar</button>` : ""}</div>` + times;
    }
    if (v.fase === "jogando") {
      if (v.souExp) return `${timerHTML(v.fim, 60000)}<div class="tabu"><div class="w">${esc(v.carta[0])}</div>${v.carta.slice(1).map((p) => `<div class="p">${esc(p)}</div>`).join("")}</div>
        <div class="row" style="margin-top:12px"><button class="btn green huge grow" data-a='${A({ type: "acertou" })}'>✅ Acertou</button></div>
        <div class="row" style="margin-top:8px"><button class="btn alt grow" data-a='${A({ type: "pular" })}'>⏭ Pular</button><button class="btn red grow" data-a='${A({ type: "proibida" })}'>🚫 Falei proibida</button></div>` + lista + times;
      if (v.fiscal) return `${timerHTML(v.fim, 60000)}<div class="tabu"><div class="w">${esc(v.carta[0])}</div>${v.carta.slice(1).map((p) => `<div class="p">${esc(p)}</div>`).join("")}</div>
        <button class="btn red huge full" style="margin-top:12px" data-a='${A({ type: "proibida" })}'>🚫 FALOU PROIBIDA!</button>` + lista + times;
      return `${timerHTML(v.fim, 60000)}<div class="card center"><div style="font-size:60px">🤔</div><h2>Adivinha!</h2><p class="muted">${esc(v.expNome)} está explicando. Grite a resposta!</p></div>` + lista + times;
    }
    if (v.fase === "resumo") return `<div class="card center"><h2>Tempo! ⏰</h2><p class="muted">${esc(v.expNome)} fez ${v.lista.filter((x) => x.r === "✅").length} acertos</p>
      <button class="btn full" data-a='${A({ type: "proxima" })}'>Próxima vez</button></div>` + lista + times;
    return "";
  };

  // ===== STOP =====
  let stopT;
  FN.stopIn = () => { clearTimeout(stopT); stopT = setTimeout(() => send({ type: "resp", resp: lerStop() }), 500); };
  const lerStop = () => S.game.view.cats.map((_, i) => ($("#st" + i) || {}).value || "");
  FN.darStop = () => send({ type: "stop", resp: lerStop() });
  R.stop = (v) => {
    const pl = placarHTML(v.placar);
    if (v.fase === "fim") return placarHTML(v.placar, "✋ Resultado final") + voltar;
    if (!v.jogando) return `<div class="card center muted">Rodada em andamento.</div>` + pl;
    if (v.fase === "contagem") return `<div class="card center"><div class="muted">Rodada ${v.r}/${v.rodadas}</div><div class="letra roleta" id="roleta">A</div><p>Sorteando a letra… <b class="timer" data-fim="${v.fim}"></b></p><div class="row" style="justify-content:center">${v.cats.map((c) => `<span class="pill">${esc(c)}</span>`).join("")}</div></div>` + pl;
    if (v.fase === "escrevendo" || v.fase === "parou") {
      const trava = v.fase === "parou";
      // rodada nova: limpa; voltou depois de cair/recarregar: puxa o que já tinha escrito (fica salvo no dono da sala)
      if (local.stopR !== v.r) { local.stopR = v.r; const m = v.minhas || []; HOOKS.push(() => v.cats.forEach((_, i) => { const el = $("#st" + i); if (el) el.value = m[i] || ""; })); }
      return `<div class="card"><div class="row" style="justify-content:space-between"><span class="muted">Rodada ${v.r}/${v.rodadas}</span>${trava ? `<b style="color:var(--red)">STOP! ${esc(v.quemParou || "Tempo")} — <span class="timer" data-fim="${v.fim}"></span></b>` : `<span>⏱ <b class="timer" data-fim="${v.fim}"></b></span>`}</div>
        <div class="letra ${local.popR !== v.r ? ((local.popR = v.r), "pop") : ""}">${v.letra}</div>
        ${v.cats.map((c, i) => `<div class="ans"><label class="l" for="st${i}">${esc(c)}</label><input id="st${i}" data-in="stopIn" autocomplete="off" autocapitalize="words" placeholder="${v.letra}…"></div>`).join("")}
        <button class="btn red huge full" style="margin-top:12px" data-fn="darStop" ${trava ? "disabled" : ""}>✋ STOP!</button></div>`;
    }
    const cel = (l, c) => `<div class="cell ${l.pts === 0 ? "inv" : ""} ${l.eu ? "mark" : ""}" ${l.id !== pid && l.txt ? `data-a='${A({ type: "marcar", alvo: l.id, c })}'` : ""}><span><small class="muted">${esc(l.nome)}:</small> ${esc(l.txt) || "—"}${l.motivo ? `<br><small style="color:var(--red);display:inline-block">${v.juiz ? "🤖" : "⚠️"} ${esc(l.motivo)}</small>` : ""}</span><span>${l.marcas ? `<small style="color:var(--red)">${v.juiz ? "🔁" : "❌"}${l.marcas}/${v.maioria}</small> ` : ""}<span class="pt">${l.pts}</span></span></div>`;
    if (v.fase === "votacao") {
      const souHost = S.hostId === pid;
      return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🗳️ Votação — letra ${v.letra}</h2><span>⏱ <b class="timer" data-fim="${v.fim}"></b></span></div>
        <p class="muted" style="margin:6px 0 0">Toque nas respostas <b style="color:var(--txt)">erradas</b> pra tirar (precisa de ${v.maioria} voto${v.maioria > 1 ? "s" : ""}). Todo mundo vê os mesmos temas, no seu ritmo. Quando terminar, aperta <b style="color:var(--txt)">Pronto</b>.</p></div>
        ${v.tabela.map((t, c) => `<div class="card"><b>${esc(t.cat)}</b>${t.linhas.map((l) => cel(l, c)).join("")}</div>`).join("")}
        <div class="card sticky-bot">
          <button class="btn ${v.souPronto ? "alt" : "green"} full" data-a='${A({ type: "pronto" })}'>${v.souPronto ? "↩️ Ainda não, quero mexer" : "✅ Pronto, terminei de votar"}</button>
          <p class="center muted" style="margin:8px 0 0">${v.faltam.length ? `Esperando: ${v.faltam.map(esc).join(", ")}` : "Fechando…"}</p>
          ${souHost ? `<button class="btn sm alt full" style="margin-top:8px" data-a='${A({ type: "encerrarVotacao", confirm: "Encerrar a votação agora pra todo mundo?" })}'>👑 Encerrar votação agora</button>` : ""}
        </div>` + pl;
    }
    if (v.fase === "correcao") {
      return `<div class="card"><h2>${v.juiz ? "🤖 Juiz automático" : "Resultado da votação"} — letra ${v.letra}</h2><p class="muted" style="margin:4px 0 0">${v.juiz ? `O juiz já tirou o que não existe ou não é do tema. Discorda? Toque na resposta: com ${v.maioria} voto${v.maioria > 1 ? "s" : ""} ela muda.` : "Votação fechada."} Igual = 5, única = 10.</p></div>
        ${v.tabela.map((t, c) => `<div class="card"><b>${esc(t.cat)}</b>${t.linhas.map((l) => (v.juiz ? cel(l, c) : cel({ ...l, id: pid }, c))).join("")}</div>`).join("")}
        <div class="card"><b>Pontos da rodada</b><div class="list" style="margin-top:6px">${Object.entries(v.rodadaPts).map(([id, p]) => `<div class="li"><span>${esc(nome(id))}</span><b>+${p}</b></div>`).join("")}</div></div>
        <button class="btn full" data-a='${A({ type: "proxima" })}'>${v.r >= v.rodadas ? "Ver resultado" : "Próxima rodada"}</button>` + pl;
    }
    return "";
  };

  // ===== DUVIDO =====
  FN.lance = () => { const n = +$("#lanceIn").value; send({ type: "lance", n }); };
  FN.maisUm = (b) => { const i = $("#lanceIn"); i.value = Math.max(+i.value || 0, +b.dataset.min) + 0; };
  R.duvido = (v) => {
    const head = `<div class="card center"><div class="muted">Rodada ${v.r}/${v.rodadas}</div><h2 style="margin:6px 0;font-size:26px">${esc(v.cat)}</h2></div>`;
    if (v.fase === "fim") return placarHTML(v.placar, "🤨 Resultado final") + voltar;
    if (v.fase === "lances") {
      const atual = v.lance ? `<div class="num">${v.lance}</div><p class="center muted">${esc(v.donoNome)} diz que consegue falar ${v.lance}</p>` : `<p class="center muted">Ninguém deu lance ainda</p>`;
      if (!v.minhaVez) return head + `<div class="card">${atual}<p class="center">Vez de <b>${esc(v.vezNome)}</b>: aumentar ou duvidar</p></div>` + placarHTML(v.placar);
      const min = v.lance + 1;
      return head + `<div class="card">${atual}<p class="center"><b style="color:var(--ac)">Sua vez!</b> Quantos você consegue falar?</p>
        <div class="row"><input id="lanceIn" type="number" inputmode="numeric" min="${min}" value="${min}" class="grow" style="font-size:22px;text-align:center;max-width:120px"><button class="btn grow" data-fn="lance">Eu falo esse tanto</button></div>
        <div class="row" style="margin-top:8px">${[1, 2, 3, 5].map((k) => `<button class="btn alt sm grow" data-a='${A({ type: "lance", n: v.lance + k })}'>${v.lance + k}</button>`).join("")}</div>
        ${v.lance ? `<button class="btn red huge full" style="margin-top:12px" data-a='${A({ type: "duvido" })}'>🤨 DUVIDO!</button>` : ""}</div>` + placarHTML(v.placar);
    }
    if (v.fase === "prova") {
      if (v.souDono) return head + `<div class="card center"><p><b>${esc(v.duvidouNome)}</b> duvidou! Fale ${v.lance} em voz alta e toque +1 a cada um.</p>${timerHTML(v.fim, v.dur)}
        <div class="counter">${v.cont}<span class="muted" style="font-size:40px">/${v.lance}</span></div>
        <button class="btn green huge full" data-a='${A({ type: "mais" })}'>+1</button>
        <div class="row" style="margin-top:8px"><button class="btn alt grow" data-a='${A({ type: "menos" })}'>−1</button><button class="btn alt grow" data-a='${A({ type: "desisto", confirm: "Desistir?" })}'>Desisto</button></div></div>`;
      return head + `<div class="card center"><p><b>${esc(v.duvidouNome)}</b> duvidou! <b>${esc(v.donoNome)}</b> tem que falar ${v.lance}. Fiquem de olho!</p>${timerHTML(v.fim, v.dur)}
        <div class="counter">${v.cont}<span class="muted" style="font-size:40px">/${v.lance}</span></div></div>`;
    }
    if (v.fase === "julgamento") {
      if (v.souDono) return head + `<div class="card center"><h2>Falou todos! 😎</h2><p class="muted">A galera está julgando se valeu… (${v.votaram}/${v.juizes})</p></div>`;
      return head + `<div class="card center"><h2>${esc(v.donoNome)} falou ${v.lance}. Valeu?</h2><p class="muted">Se tinha resposta errada ou repetida, não vale.</p>
        ${v.votei ? `<p>Voto enviado ✅ (${v.votaram}/${v.juizes})</p>` : `<div class="row"><button class="btn green huge grow" data-a='${A({ type: "voto", valeu: true })}'>👍 Valeu</button><button class="btn red huge grow" data-a='${A({ type: "voto", valeu: false })}'>👎 Não valeu</button></div>`}</div>`;
    }
    if (v.fase === "resultado") return head + `<div class="card center"><div style="font-size:50px">${v.res.ok ? "😎" : "😂"}</div><h2>${v.res.ok ? `${esc(v.donoNome)} provou!` : `${esc(v.donoNome)} não conseguiu!`}</h2><p><b>${esc(v.res.vencNome)}</b> ganhou +2</p>
      <button class="btn full" data-a='${A({ type: "proxima" })}'>${v.r >= v.rodadas ? "Ver resultado" : "Próxima rodada"}</button></div>` + placarHTML(v.placar);
    return "";
  };

  // nome lembrado
  conectar();
  setTimeout(() => { const n = document.getElementById("nomeIn"); try { const s = localStorage.getItem("jv_nome"); if (n && s && !n.value) n.value = s; } catch (e) {} }, 400);
})();

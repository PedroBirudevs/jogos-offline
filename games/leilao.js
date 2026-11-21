// Leilão OVER (inspirado no 100pracada): R$ 100 pra cada técnico, lances ao vivo de 10s,
// bots opcionais, pontos corridos / mata-mata / os dois, e partidas AO VIVO com
// formação, estilo e postura mudando durante o jogo. Prorrogação com gol de ouro no mata-mata.
const DB = require("../data/jogadores.json");
const ALL = DB.rows.map((r, i) => { const o = { id: i }; DB.cols.forEach((c, k) => (o[c] = r[k])); return o; });
const LIGAS = ["Brasileirão", "Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1"];
const BASES = { "Todas juntas (+ Portugal, Arábia e Holanda)": () => ALL };
// Liga sozinha: nota relativa à própria liga (o melhor do Brasileirão vira ~91, igual ao melhor da Premier).
// "Todas juntas": escala única do mundo (aí o Pedro não fica igual ao Luis Díaz).
const TOPO = 91;
function escalaLiga(lista) {
  const v = lista.map((p) => p.ovr).sort((a, b) => a - b);
  const M = v[v.length - 1], m = v[Math.floor(v.length * 0.2)];
  if (!(M > m) || M >= TOPO) return lista;
  return lista.map((p) => {
    const d = Math.round((TOPO - M) * Math.max(0, Math.min(1, (p.ovr - m) / (M - m))));
    if (!d) return p;
    const up = (x) => Math.min(99, x + d);
    return { ...p, ovr: p.ovr + d, pac: up(p.pac), sho: up(p.sho), pas: up(p.pas), dri: up(p.dri), def: up(p.def), phy: up(p.phy) };
  });
}
for (const l of LIGAS) { const lst = escalaLiga(ALL.filter((p) => p.liga === l)); BASES[l] = () => lst; }
const FORMACAO = { 5: { GOL: 1, DEF: 2, MEI: 1, ATA: 1 }, 7: { GOL: 1, DEF: 2, MEI: 2, ATA: 2 }, 11: { GOL: 1, DEF: 4, MEI: 3, ATA: 3 } };
const ESQUEMAS = {
  5: ["2-1-1", "1-2-1", "1-1-2", "3-1-0"],
  7: ["2-2-2", "3-2-1", "2-3-1", "2-1-3", "4-1-1"],
  11: ["4-3-3", "4-4-2", "3-5-2", "4-2-4", "5-3-2", "5-4-1"],
};
const ESTILOS = ["Equilibrado", "Toque de bola", "Contra-ataque", "Jogo direto"];
const POSTURAS = ["Retranca", "Defensiva", "Equilibrada", "Ofensiva", "Tudo pro ataque"];
const BOTS = ["Bot Tite", "Bot Abel", "Bot Felipão", "Bot Ancelotti", "Bot Dorival", "Bot Renato", "Bot Luxemburgo", "Bot Jorge Jesus", "Bot Diniz", "Bot Cuca", "Bot Mano", "Bot Zagallo"];
const ORC = 100;
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const TICK = Number(process.env.JV_TICK) || 400; // ms por minuto de jogo (90 min ≈ 36 s)

function ratings(t) {
  const by = (g) => t.elenco.filter((j) => j.grupo === g);
  const ata = by("ATA").map((j) => j.sho * 0.45 + j.pac * 0.3 + j.dri * 0.25);
  const mei = by("MEI").map((j) => j.pas * 0.4 + j.dri * 0.35 + j.sho * 0.25);
  const def = by("DEF").map((j) => j.def * 0.6 + j.phy * 0.4);
  const gol = by("GOL").map((j) => j.ovr);
  return {
    ataque: Math.round(avg([...ata, ...ata, ...mei]) || 50),
    defesa: Math.round(avg([...def, ...def, ...(gol.length ? gol : [45]), ...(gol.length ? gol : [45])]) || 50),
    geral: Math.round(avg(t.elenco.map((j) => j.ovr)) || 50),
    goleiro: gol.length ? gol[0] : 45,
  };
}
// multiplicadores táticos: [ataque próprio, chances que concede]
function taticaMult(n, tat, tatAdv) {
  const base = ESQUEMAS[n][0].split("-").map(Number);
  const f = tat.form.split("-").map(Number);
  const [d0, m0, a0] = [base[0], base[1], base[2] || 0], [d, m, a] = [f[0], f[1], f[2] || 0];
  let atk = 1 + 0.07 * (a - a0) + 0.035 * (m - m0) - 0.03 * (d - d0);
  let con = 1 - 0.06 * (d - d0) - 0.025 * (m - m0) + 0.05 * (a - a0);
  const p = POSTURAS.indexOf(tat.postura) - 2; // -2..2
  atk *= 1 + 0.14 * p; con *= 1 + 0.13 * p;
  if (tat.estilo === "Toque de bola") { atk *= 1.03; con *= 0.92; }
  if (tat.estilo === "Contra-ataque") { const pa = POSTURAS.indexOf(tatAdv.postura) - 2; atk *= 0.93 + 0.08 * Math.max(0, pa); con *= 0.95; }
  if (tat.estilo === "Jogo direto") { atk *= 1.1; con *= 1.06; }
  return [Math.max(0.35, atk), Math.max(0.35, con)];
}
function quemFez(t) {
  const w = t.elenco.map((j) => ({ j, w: j.grupo === "ATA" ? j.sho : j.grupo === "MEI" ? j.sho * 0.5 : j.grupo === "DEF" ? j.sho * 0.12 : 0 }));
  const tot = w.reduce((s, x) => s + x.w, 0); if (!tot) return null;
  let r = Math.random() * tot; for (const x of w) { r -= x.w; if (r <= 0) return x.j; } return w[0].j;
}
const fs = require("fs"), path = require("path");
const FOTOS = path.join(__dirname, "..", "public", "fotos");
const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let TEM = new Set(), TEM_t = 0;
const temFoto = (j) => {
  if (Date.now() - TEM_t > 10000) { TEM_t = Date.now(); try { TEM = new Set(fs.readdirSync(FOTOS)); } catch (e) { TEM = new Set(); } }
  const f = slug(j.nome + "-" + j.clube) + ".jpg";
  return TEM.has(f) ? "/fotos/" + f : null;
};
const pub = (j) => j && { foto: j.id >= 0 ? temFoto(j) : null, id: j.id, nome: j.nome, pos: j.pos, grupo: j.grupo, ovr: j.ovr, pac: j.pac, sho: j.sho, pas: j.pas, dri: j.dri, def: j.def, phy: j.phy, clube: j.clube, liga: j.liga, flag: j.flag, aprox: !!j.aprox, preco: j.preco };
function calendario(ids) {
  const a = [...ids]; if (a.length % 2) a.push(null);
  const n = a.length, rod = [];
  for (let r = 0; r < n - 1; r++) {
    const js = [];
    for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; if (x && y) js.push(r % 2 ? [y, x] : [x, y]); }
    rod.push(js); a.splice(1, 0, a.pop());
  }
  return [...rod, ...rod.map((js) => js.map(([x, y]) => [y, x]))];
}

module.exports = {
  key: "leilao",
  ordem: 1,
  nome: "Leilão OVER",
  emoji: "⚽",
  desc: "R$ 100 pra cada técnico. Lances de 10s em jogadores reais (EA FC 27), monte o time e jogue partidas ao vivo mudando a tática.",
  min: 1,
  opcoes: [
    { id: "base", nome: "Jogadores do leilão", valores: Object.keys(BASES), padrao: "Brasileirão" },
    { id: "elenco", nome: "Jogadores em campo", valores: ["5", "7", "11"], padrao: "5" },
    { id: "formato", nome: "Formato do campeonato", valores: ["Pontos corridos + mata-mata", "Pontos corridos", "Mata-mata"], padrao: "Pontos corridos + mata-mata" },
    { id: "bots", nome: "Bots pra completar", valores: ["Nenhum", "Até 4 times", "Até 6 times", "Até 8 times"], padrao: "Nenhum" },
    { id: "tempo", nome: "Segundos por lance", valores: [10, 8, 15], padrao: 10 },
  ],

  init(list, o, ctx) {
    const n = Number(parseInt(o.elenco)) || 5;
    const alvo = { "Até 4 times": 4, "Até 6 times": 6, "Até 8 times": 8 }[o.bots] || 0;
    const times = list.map((p) => ({ id: p.id, nome: p.name, dinheiro: ORC, elenco: [], bot: false }));
    const nb = Math.max(alvo - times.length, times.length < 2 ? 1 : 0);
    shuffle(BOTS).slice(0, nb).forEach((nome, i) => times.push({ id: "bot" + i, nome, dinheiro: ORC, elenco: [], bot: true, estilo: Math.random() }));
    const base = (BASES[o.base] || BASES["Brasileirão"])();
    const pool = {};
    for (const g of ["GOL", "DEF", "MEI", "ATA"]) pool[g] = base.filter((p) => p.grupo === g).sort((a, b) => b.ovr - a.ovr);
    const st = {
      fase: "leilao", base: o.base || "Brasileirão", n, form: { ...FORMACAO[n] }, tempo: (Number(o.tempo) || 10) * 1000,
      formato: o.formato || "Pontos corridos + mata-mata", times, pool, lote: null, log: [], timer: null, lotes: 0,
      fator: 5 / n, tatica: {},
    };
    this._proximo(st, ctx);
    return st;
  },
  _time(st, id) { return st.times.find((t) => t.id === id); },
  _falta(st, t, g) { return st.form[g] - t.elenco.filter((j) => j.grupo === g).length; },
  _cheio(st, t) { return t.elenco.length >= st.n; },
  _max(st, t) { return t.dinheiro - (st.n - t.elenco.length - 1); },
  _base(st, ovr) { return Math.max(1, Math.round((Math.pow(Math.max(0, ovr - 68), 1.55) / 2.2) * st.fator)); },
  _completar(st, so) {
    for (const t of st.times) for (const g of so ? [so] : ["GOL", "DEF", "MEI", "ATA"]) while (this._falta(st, t, g) > 0) {
      const v = 58; t.elenco.push({ id: -1, nome: "Base " + g, pos: g, grupo: g, ovr: v, pac: v, sho: v, pas: v, dri: v, def: v, phy: v, clube: "Sub-20", liga: "", flag: "🏳️", preco: 0 });
    }
  },
  // ---------------- LEILÃO ----------------
  _proximo(st, ctx) {
    if (st.times.every((t) => this._cheio(st, t))) return this._fimLeilao(st, ctx);
    const need = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
    for (const t of st.times) for (const g in need) if (this._max(st, t) >= 1) need[g] += Math.max(0, this._falta(st, t, g));
    const tot = Object.values(need).reduce((s, x) => s + x, 0);
    if (!tot || st.lotes > 500) { this._completar(st); return this._fimLeilao(st, ctx); }
    let r = Math.random() * tot, g = "ATA";
    for (const k in need) { r -= need[k]; if (r <= 0) { g = k; break; } }
    const P = st.pool[g];
    if (!P.length) { this._completar(st, g); return this._proximo(st, ctx); }
    const precisam = st.times.filter((t) => !this._cheio(st, t) && this._falta(st, t, g) > 0);
    const teto = Math.max(1, ...precisam.map((t) => this._max(st, t)));
    let idx = Math.floor(P.length * Math.pow(Math.random(), 2.2));
    if (this._base(st, P[idx].ovr) > teto) { // quem precisa está sem grana: vem um jogador que cabe no bolso
      const ok = P.map((p, i) => i).filter((i) => this._base(st, P[i].ovr) <= teto);
      if (ok.length) idx = ok[Math.floor(ok.length * Math.pow(Math.random(), 1.5))];
    }
    const j = P.splice(idx, 1)[0];
    st.lotes++;
    st.lote = { j, preco: 1 /* todo jogador começa em R$ 1 */, lider: null, fim: ctx.now() + st.tempo, passou: [], vendido: false };
    st.timer = ctx.later(st.tempo, () => this._fechar(st, ctx));
    this._botsPensam(st, ctx);
  },
  _fimLeilao(st, ctx) {
    st.lote = null; st.fase = "times";
    for (const t of st.times) st.tatica[t.id] = { form: ESQUEMAS[st.n][0], estilo: "Equilibrado", postura: "Equilibrada" };
  },
  _fechar(st, ctx) {
    const L = st.lote; if (!L || L.vendido) return;
    ctx.cancel(st.timer); L.vendido = true;
    if (L.lider) {
      const t = this._time(st, L.lider);
      t.dinheiro -= L.preco; t.elenco.push({ ...L.j, preco: L.preco });
      st.log.unshift(`${t.nome} levou ${L.j.nome} (${L.j.ovr}) por R$ ${L.preco}`);
    } else st.log.unshift(`Ninguém quis ${L.j.nome} (${L.j.ovr})`);
    st.log = st.log.slice(0, 6);
    L.fim = ctx.now() + 2200;
    st.timer = ctx.later(2200, () => this._proximo(st, ctx));
  },
  _pode(st, t, valor) { return !this._cheio(st, t) && this._falta(st, t, st.lote.j.grupo) > 0 && this._max(st, t) >= valor; },
  // quem caiu passa a vez no lote automaticamente (ninguém fica esperando o timer à toa)
  tick(st, ctx) {
    if (st.fase !== "leilao" || !st.lote || st.lote.vendido) return false;
    let mudou = false;
    for (const t of st.times) if (!t.bot && !ctx.online(t.id) && !st.lote.passou.includes(t.id) && st.lote.lider !== t.id) { st.lote.passou.push(t.id); mudou = true; }
    if (mudou) this._checaPasses(st, ctx);
    return mudou;
  },
  _checaPasses(st, ctx) {
    const L = st.lote;
    const ativos = st.times.filter((t) => t.id !== L.lider && this._pode(st, t, L.lider ? L.preco + 1 : L.preco));
    if (ativos.every((t) => L.passou.includes(t.id))) this._fechar(st, ctx);
  },
  _lance(st, t, inc, ctx) {
    const L = st.lote;
    const valor = L.lider ? L.preco + Math.max(1, Number(inc) || 1) : L.preco;
    if (valor > this._max(st, t)) return `Você só pode dar até R$ ${this._max(st, t)}`;
    L.preco = valor; L.lider = t.id; L.passou = L.passou.filter((x) => x !== t.id);
    L.fim = ctx.now() + st.tempo;
    ctx.cancel(st.timer); st.timer = ctx.later(st.tempo, () => this._fechar(st, ctx));
    this._checaPasses(st, ctx);
    if (!L.vendido) this._botsPensam(st, ctx);
  },
  _botsPensam(st, ctx) {
    const L = st.lote;
    for (const t of st.times.filter((x) => x.bot)) {
      if (t.id === L.lider || L.passou.includes(t.id)) continue;
      if (!this._pode(st, t, L.lider ? L.preco + 1 : L.preco)) { L.passou.push(t.id); continue; }
      // quanto o bot acha que vale: base do jogador × apetite, limitado pelo dinheiro por vaga
      if (!L.teto) L.teto = {};
      if (L.teto[t.id] === undefined) {
        const porVaga = t.dinheiro / (st.n - t.elenco.length);
        const apetite = rnd(1.0, 1.9) * (0.85 + t.estilo * 0.4);
        L.teto[t.id] = Math.min(this._max(st, t), Math.round(Math.max(this._base(st, L.j.ovr) * apetite, L.j.ovr >= 80 ? porVaga * 1.3 : porVaga * 0.6)));
      }
      ctx.later(rnd(700, Math.min(st.tempo - 2000, 3000)), () => {
        const L2 = st.lote; if (L2 !== L || L.vendido || L.lider === t.id) return;
        const prox = L.lider ? L.preco + 1 : L.preco;
        if (prox <= L.teto[t.id] && this._pode(st, t, prox)) {
          const folga = L.teto[t.id] - L.preco; // quanto ainda acha que vale a mais
          const inc = folga > 6 ? Math.max(1, Math.round(folga * rnd(0.15, 0.45))) : 1;
          this._lance(st, t, L.lider ? inc : 0, ctx);
        }
        else { if (!L.passou.includes(t.id)) L.passou.push(t.id); this._checaPasses(st, ctx); }
      });
    }
  },
  // ---------------- CAMPEONATO ----------------
  _novaRodada(st, pares, mata, titulo, ctx) {
    st.fase = "aovivo"; st.titulo = titulo; st.mata = mata;
    st.jogos = pares.map(([a, b]) => ({ a, b, ga: 0, gb: 0, ev: [], fim: false, pen: null, prorr: false }));
    st.min = 0;
    const tick = () => {
      st.min++;
      let rodando = false;
      for (const g of st.jogos) {
        if (g.fim) continue;
        if (st.min > 90 && !(mata && g.ga === g.gb)) { g.fim = true; continue; }
        if (st.min > 90) g.prorr = true;
        this._minuto(st, g);
        if (g.prorr && g.ga !== g.gb) { g.fim = true; g.ev.unshift({ m: st.min, t: "⚡ GOL DE OURO!" }); continue; }
        if (st.min >= 120) { g.fim = true; this._penaltis(st, g); continue; }
        rodando = true;
      }
      for (const t of st.times.filter((x) => x.bot)) this._botTatica(st, t);
      if (rodando) ctx.later(TICK, tick); else this._fimRodada(st, ctx);
    };
    ctx.later(1500, tick);
  },
  _minuto(st, g) {
    const A = this._time(st, g.a), B = this._time(st, g.b), ra = ratings(A), rb = ratings(B);
    const [atkA, conA] = taticaMult(st.n, st.tatica[g.a], st.tatica[g.b]), [atkB, conB] = taticaMult(st.n, st.tatica[g.b], st.tatica[g.a]);
    const casa = st.mata ? 0 : 0.12;
    const la = (1.2 * Math.exp((ra.ataque - rb.defesa) / 14 + (ra.geral - rb.geral) / 22) + casa) * atkA * conB;
    const lb = (1.1 * Math.exp((rb.ataque - ra.defesa) / 14 + (rb.geral - ra.geral) / 22)) * atkB * conA;
    for (const [T, l, gkAdv, lado] of [[A, la, rb.goleiro, "a"], [B, lb, ra.goleiro, "b"]]) {
      if (Math.random() < (l / 90) * 2.3) {
        const j = quemFez(T);
        const conv = Math.min(0.75, Math.max(0.2, 0.43 * ((j ? j.sho : 60) / 78) * (78 / gkAdv)));
        if (Math.random() < conv) {
          if (lado === "a") g.ga++; else g.gb++;
          g.ev.unshift({ m: st.min, t: `⚽ ${j ? j.nome : "Gol contra"} (${T.nome})`, gol: true });
        } else if (Math.random() < 0.45) g.ev.unshift({ m: st.min, t: `🧤 Chance de ${j ? j.nome : T.nome}, defendeu!` });
      }
    }
    if (st.min === 45) g.ev.unshift({ m: 45, t: "⏸ Intervalo" });
    g.ev = g.ev.slice(0, 14);
  },
  _penaltis(st, g) {
    const ka = ratings(this._time(st, g.a)).goleiro, kb = ratings(this._time(st, g.b)).goleiro;
    let pa = 0, pb = 0, i = 0; const pA = 0.75 - (kb - 75) / 150, pB = 0.75 - (ka - 75) / 150;
    while (i < 5 || pa === pb) { if (Math.random() < pA) pa++; if (Math.random() < pB) pb++; i++; if (i > 30) { pa++; break; } }
    g.pen = [pa, pb]; g.ev.unshift({ m: 120, t: `🥅 Pênaltis: ${pa} x ${pb}` });
  },
  _venc(g) { return g.ga > g.gb ? g.a : g.gb > g.ga ? g.b : g.pen ? (g.pen[0] > g.pen[1] ? g.a : g.b) : null; },
  _botTatica(st, t) {
    const g = (st.jogos || []).find((x) => !x.fim && (x.a === t.id || x.b === t.id)); if (!g) return;
    const meu = g.a === t.id ? g.ga : g.gb, dele = g.a === t.id ? g.gb : g.ga, tat = st.tatica[t.id];
    if (st.min === 70 || st.min === 100) {
      if (meu < dele) { tat.postura = "Ofensiva"; tat.estilo = "Jogo direto"; tat.form = ESQUEMAS[st.n].find((f) => +f.split("-").pop() >= 3) || tat.form; }
      else if (meu > dele) { tat.postura = "Defensiva"; tat.estilo = "Contra-ataque"; }
    }
  },
  _fimRodada(st, ctx) {
    for (const g of st.jogos) {
      for (const e of g.ev) if (e.gol) { const nome = e.t.replace("⚽ ", "").replace(/ \(.*\)$/, ""); const time = e.t.match(/\((.*)\)$/); if (nome === "Gol contra") continue; const k = nome + "|" + (time ? time[1] : ""); st.gols[k] = st.gols[k] || { nome, time: time ? time[1] : "", gols: 0 }; st.gols[k].gols++; }
      if (st.etapa === "liga") {
        const A = st.tab[g.a], B = st.tab[g.b];
        A.j++; B.j++; A.gp += g.ga; A.gc += g.gb; B.gp += g.gb; B.gc += g.ga;
        if (g.ga > g.gb) { A.v++; B.d++; A.pts += 3; } else if (g.gb > g.ga) { B.v++; A.d++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
      }
    }
    st.fase = "intervalo";
    st.historico.push({ titulo: st.titulo, jogos: st.jogos.map((g) => ({ a: g.a, b: g.b, ga: g.ga, gb: g.gb, pen: g.pen, prorr: g.prorr })) });
    if (st.etapa === "mata") {
      const venc = st.jogos.map((g) => this._venc(g));
      st.vivos = [...venc, ...st.byes];
      st.byes = [];
      if (st.vivos.length === 1) { st.campeao = st.vivos[0]; st.fase = "fim"; this._encerrar(st, ctx); }
    }
  },
  _chaveMata(st, ids) {
    // potência de 2 com folgas (byes) pros melhores
    let p = 1; while (p < ids.length) p *= 2;
    const byes = p - ids.length;
    st.byes = ids.slice(0, byes);
    const resto = ids.slice(byes);
    const pares = [];
    for (let i = 0; i < resto.length / 2; i++) pares.push([resto[i], resto[resto.length - 1 - i]]);
    return pares;
  },
  _nomeFase(n) { return n <= 2 ? "🏆 Final" : n <= 4 ? "Semifinal" : n <= 8 ? "Quartas de final" : "Oitavas de final"; },
  _encerrar(st, ctx) {
    const melhor = this._gastouMelhor(st)[0];
    const art = this._artilharia(st)[0];
    ctx.finish({ titulo: `⚽ Campeão: ${this._time(st, st.campeao).nome}`, linhas: [
      ...(art ? [{ nome: `Artilheiro: ${art.nome} (${art.time})`, pontos: art.gols + " gols" }] : []),
      ...(melhor ? [{ nome: `🏅 Gastou melhor: ${melhor.nome}`, pontos: `${melhor.geral} OVR / R$ ${melhor.gasto}` }] : []),
    ] });
  },
  _gastouMelhor(st) {
    return st.times.map((t) => { const gasto = ORC - t.dinheiro, r = ratings(t); return { id: t.id, nome: t.nome, gasto, geral: r.geral, nota: (r.geral - 55) / Math.max(10, gasto) }; })
      .sort((a, b) => b.nota - a.nota);
  },
  act(st, pid, a, ctx) {
    const t = this._time(st, pid);
    if (a.type === "lance" && st.fase === "leilao") {
      const L = st.lote;
      if (!L || L.vendido) return "Espere o próximo jogador";
      if (!t) return "Você está só assistindo";
      if (this._cheio(st, t)) return "Seu time já está completo";
      if (this._falta(st, t, L.j.grupo) <= 0) return `Você já tem todos os ${L.j.grupo} que precisa`;
      if (L.lider === pid) return "Você já está ganhando";
      return this._lance(st, t, a.inc, ctx);
    }
    if (a.type === "passar" && st.fase === "leilao") {
      const L = st.lote; if (!L || L.vendido || L.lider === pid) return;
      if (!L.passou.includes(pid)) L.passou.push(pid);
      this._checaPasses(st, ctx); return;
    }
    if (a.type === "tatica" && st.tatica[pid]) {
      const tat = st.tatica[pid];
      if (a.form && ESQUEMAS[st.n].includes(a.form)) tat.form = a.form;
      if (a.estilo && ESTILOS.includes(a.estilo)) tat.estilo = a.estilo;
      if (a.postura && POSTURAS.includes(a.postura)) tat.postura = a.postura;
      return;
    }
    if (a.type === "comecar" && st.fase === "times") {
      st.gols = {}; st.historico = [];
      st.tab = Object.fromEntries(st.times.map((x) => [x.id, { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }]));
      if (st.formato === "Mata-mata") {
        st.etapa = "mata";
        const ids = st.times.map((x) => x.id).sort((x, y) => ratings(this._time(st, y)).geral - ratings(this._time(st, x)).geral);
        const pares = this._chaveMata(st, ids);
        return this._novaRodada(st, pares, true, this._nomeFase(ids.length), ctx);
      }
      st.etapa = "liga"; st.rodadas = calendario(st.times.map((x) => x.id)); st.r = 0;
      return this._novaRodada(st, st.rodadas[0], false, `Rodada 1/${st.rodadas.length}`, ctx);
    }
    if (a.type === "proxima" && st.fase === "intervalo") {
      if (st.etapa === "liga") {
        st.r++;
        if (st.r < st.rodadas.length) return this._novaRodada(st, st.rodadas[st.r], false, `Rodada ${st.r + 1}/${st.rodadas.length}${st.r >= st.rodadas.length / 2 ? " · volta" : " · ida"}`, ctx);
        if (st.formato === "Pontos corridos") {
          st.campeao = this._classif(st)[0].id; st.fase = "fim"; this._encerrar(st, ctx); return;
        }
        st.etapa = "mata";
        const cl = this._classif(st).map((x) => x.id);
        const ids = cl.length >= 4 ? cl.slice(0, 4) : cl.slice(0, 2);
        return this._novaRodada(st, this._chaveMata(st, ids), true, this._nomeFase(ids.length), ctx);
      }
      if (st.etapa === "mata") {
        const ids = st.vivos;
        return this._novaRodada(st, this._chaveMata(st, ids), true, this._nomeFase(ids.length), ctx);
      }
    }
  },
  _classif(st) {
    return st.times.map((t) => ({ id: t.id, nome: t.nome, ...st.tab[t.id], sg: st.tab[t.id].gp - st.tab[t.id].gc }))
      .sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || b.v - a.v);
  },
  _artilharia(st) { return Object.values(st.gols || {}).sort((a, b) => b.gols - a.gols).slice(0, 8); },
  view(st, pid) {
    const me = this._time(st, pid);
    const times = st.times.map((t) => ({ id: t.id, nome: t.nome, bot: t.bot, dinheiro: t.dinheiro, elenco: t.elenco.map(pub), r: ratings(t), falta: Object.fromEntries(["GOL", "DEF", "MEI", "ATA"].map((g) => [g, this._falta(st, t, g)])) }));
    const v = { fase: st.fase, n: st.n, form: st.form, base: st.base, formato: st.formato, times, log: st.log, tempo: st.tempo, orc: ORC };
    if (st.fase === "leilao" && st.lote) {
      const L = st.lote;
      v.lote = { j: pub(L.j), preco: L.preco, lider: L.lider, liderNome: L.lider ? this._time(st, L.lider).nome : null, fim: L.fim, vendido: L.vendido, passei: L.passou.includes(pid) };
      v.restantes = Object.values(st.pool).reduce((s, x) => s + x.length, 0);
      if (me) { v.meuMax = this._max(st, me); v.cheio = this._cheio(st, me); v.precisoDessa = this._falta(st, me, L.j.grupo) > 0; }
    }
    if (st.tatica[pid]) { v.minhaTatica = st.tatica[pid]; v.esquemas = ESQUEMAS[st.n]; v.estilos = ESTILOS; v.posturas = POSTURAS; }
    if (st.jogos) {
      v.min = st.min; v.titulo = st.titulo; v.mata = st.mata; v.etapa = st.etapa;
      v.jogos = st.jogos.map((g) => ({ ...g, tatA: st.tatica[g.a], tatB: st.tatica[g.b] }));
    }
    if (st.tab) { v.tabela = this._classif(st); v.artilharia = this._artilharia(st); v.r = st.r; v.totalRodadas = st.rodadas ? st.rodadas.length : 0; }
    if (st.fase === "intervalo" && st.etapa === "liga" && st.r + 1 >= st.rodadas.length) v.proxTxt = st.formato === "Pontos corridos" ? "Ver campeão 🏆" : "Ir pro mata-mata 🏆";
    if (st.fase === "intervalo" && st.etapa === "mata") v.proxTxt = this._nomeFase(st.vivos.length);
    if (st.fase === "fim") { v.campeao = st.campeao; v.gastouMelhor = this._gastouMelhor(st).slice(0, 3); }
    return v;
  },
};
module.exports._BASES = BASES;

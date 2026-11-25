// Leilão OVER (inspirado no 100pracada): R$ 100 pra cada técnico, lances ao vivo de 10s,
// bots opcionais, pontos corridos / mata-mata / os dois, e partidas AO VIVO com
// formação, estilo e postura mudando durante o jogo. Prorrogação com gol de ouro no mata-mata.
const DB = require("../data/jogadores.json");
const ALL = DB.rows.map((r, i) => { const o = { id: i }; DB.cols.forEach((c, k) => (o[c] = r[k])); return o; });
// ---------- posições: cada jogador pode fazer mais de uma (Valverde: meia e lateral; Vini: ponta e atacante) ----------
const GRUPO_POS = { GOL: "GOL", ZAG: "DEF", LE: "DEF", LD: "DEF", ALE: "DEF", ALD: "DEF", VOL: "MEI", MC: "MEI", MEI: "MEI", ME: "MEI", MD: "MEI", ATA: "ATA", SA: "ATA", PE: "ATA", PD: "ATA" };
for (const o of ALL) {
  o.pos2 = String(o.pos2 || "").split(",").filter((x) => GRUPO_POS[x]);
  o.grupos = [...new Set([o.grupo, ...o.pos2.map((x) => GRUPO_POS[x])])];
  if (o.grupo === "GOL") o.grupos = ["GOL"]; // goleiro é só goleiro (e linha não vira goleiro)
  else o.grupos = o.grupos.filter((g) => g !== "GOL");
}
const gruposDe = (j) => j.grupos || [j.grupo];
// encaixa o elenco na formação: devolve a vaga (setor) de cada jogador, ou null se não cabe
function encaixe(lista, form) {
  const cap = { ...form }, res = new Array(lista.length);
  const ord = lista.map((_, i) => i).sort((a, b) => gruposDe(lista[a]).length - gruposDe(lista[b]).length);
  const go = (k) => {
    if (k === ord.length) return true;
    const i = ord[k], j = lista[i];
    for (const g of [j.grupo, ...gruposDe(j).filter((x) => x !== j.grupo)]) if (cap[g] > 0) { cap[g]--; res[i] = g; if (go(k + 1)) return true; cap[g]++; }
    return false;
  };
  return go(0) ? res : null;
}
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
// ---------- fila do leilão: só titulares bons, na medida certa ----------
// Titular = os melhores de cada clube por posição (1 GOL, 4 DEF, 3 MEI, 3 ATA, como num 4-3-3).
const TITULARES = { GOL: 1, DEF: 4, MEI: 3, ATA: 3 };
function titulares(lista) {
  const porClube = {};
  for (const p of lista) (porClube[p.clube] = porClube[p.clube] || []).push(p);
  const out = [];
  for (const js of Object.values(porClube))
    for (const g in TITULARES) out.push(...js.filter((p) => p.grupo === g).sort((a, b) => b.ovr - a.ovr).slice(0, TITULARES[g]));
  return out;
}
// Quantos entram: (times × vagas da posição) + 2 sobras por time, repartidas entre as posições.
// Ex.: 10 times de 5 → 50 vagas + 20 sobras = 70 jogadores. Sorteados entre os melhores titulares, então cada leilão é diferente.
function montarFila(base, nTimes, form) {
  const tits = titulares(base);
  const vagas = Object.values(form).reduce((s, x) => s + x, 0);
  const extras = 2 * nTimes;
  const pool = {}, reserva = {};
  let sobrou = extras;
  const gs = ["GOL", "DEF", "MEI", "ATA"];
  const ext = {};
  gs.forEach((g) => { ext[g] = Math.floor((extras * form[g]) / vagas); sobrou -= ext[g]; });
  for (const g of ["ATA", "MEI", "DEF", "GOL"]) if (sobrou > 0) { ext[g]++; sobrou--; }
  for (const g of gs) {
    const cands = tits.filter((p) => p.grupo === g).sort((a, b) => b.ovr - a.ovr);
    const k = nTimes * form[g] + ext[g];
    const topo = cands.slice(0, Math.min(cands.length, Math.ceil(k * 1.6))); // só os bons
    const escolhidos = shuffle(topo).slice(0, k);
    const ids = new Set(escolhidos.map((p) => p.id));
    pool[g] = escolhidos.sort((a, b) => b.ovr - a.ovr);
    reserva[g] = cands.filter((p) => !ids.has(p.id)); // se faltar (ninguém quis alguém), puxa daqui
  }
  return { pool, reserva };
}
const FORMACAO = { 5: { GOL: 1, DEF: 2, MEI: 1, ATA: 1 }, 7: { GOL: 1, DEF: 2, MEI: 2, ATA: 2 }, 11: { GOL: 1, DEF: 4, MEI: 3, ATA: 3 } };
const ESQUEMAS = {
  5: ["2-1-1", "1-2-1", "1-1-2", "2-0-2", "3-0-1", "1-0-3", "3-1-0"],
  7: ["2-2-2", "3-2-1", "2-3-1", "2-1-3", "3-1-2", "4-1-1"],
  11: ["4-3-3", "4-4-2", "3-5-2", "4-2-4", "5-3-2", "5-4-1"],
};
const ESTILOS = ["Equilibrado", "Toque de bola", "Contra-ataque", "Jogo direto"];
const POSTURAS = ["Retranca", "Defensiva", "Equilibrada", "Ofensiva", "Tudo pro ataque"];
const BOTS = ["Bot Tite", "Bot Abel", "Bot Felipão", "Bot Ancelotti", "Bot Dorival", "Bot Renato", "Bot Luxemburgo", "Bot Jorge Jesus", "Bot Diniz", "Bot Cuca", "Bot Mano", "Bot Zagallo"];
const ORC = 100;
const RES_GRUPOS = ["DEF", "MEI", "ATA"];
const RAPIDO = !!process.env.JV_RAPIDO; // só pra teste automático
const MARTELO = RAPIDO ? 700 : 5000; // depois de um lance: "dou-lhe uma, dou-lhe duas…" — 5s pra alguém cobrir
const APELIDO_ESQ = { "3-0-1": "Retranca", "1-0-3": "Tudo ou nada", "3-1-0": "Ônibus", "4-1-1": "Retranca", "2-1-3": "Ataque total" };
const esqParaForm = (e) => { const [d, m, a] = e.split("-").map(Number); return { GOL: 1, DEF: d, MEI: m, ATA: a }; };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const TICK = Number(process.env.JV_TICK) || 400; // ms por minuto de jogo (90 min ≈ 36 s)

function ratings(t) {
  const by = (g) => t.elenco.filter((j) => (j.slot || j.grupo) === g);
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
const pub = (j) => j && { foto: j.id >= 0 ? temFoto(j) : null, id: j.id, nome: j.nome, pos: j.pos, pos2: j.pos2 || [], grupos: gruposDe(j), slot: j.slot || j.grupo, grupo: j.grupo, ovr: j.ovr, pac: j.pac, sho: j.sho, pas: j.pas, dri: j.dri, def: j.def, phy: j.phy, clube: j.clube, liga: j.liga, flag: j.flag, aprox: !!j.aprox, preco: j.preco };
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
    { id: "nota", nome: "Overall dos jogadores", valores: ["Mostrar", "Esconder (tem que conhecer!)"], padrao: "Mostrar" },
  ],

  init(list, o, ctx) {
    const n = Number(parseInt(o.elenco)) || 5;
    const alvo = { "Até 4 times": 4, "Até 6 times": 6, "Até 8 times": 8 }[o.bots] || 0;
    const esq0 = ESQUEMAS[n][0];
    const times = list.map((p) => ({ id: p.id, nome: p.name, dinheiro: ORC, elenco: [], bot: false, esq: esq0, form: esqParaForm(esq0) }));
    const nb = Math.max(alvo - times.length, times.length < 2 ? 1 : 0);
    shuffle(BOTS).slice(0, nb).forEach((nome, i) => times.push({ id: "bot" + i, nome, dinheiro: ORC, elenco: [], bot: true, estilo: Math.random(), esq: esq0, form: esqParaForm(esq0) }));
    const base = (BASES[o.base] || BASES["Brasileirão"])();
    const { pool, reserva } = montarFila(base, times.length, FORMACAO[n]);
    const st = {
      fase: "leilao", base: o.base || "Brasileirão", n, form: { ...FORMACAO[n] }, tempo: RAPIDO ? 1200 : (Number(o.tempo) || 10) * 1000,
      formato: o.formato || "Pontos corridos + mata-mata", times, pool, reserva, lote: null, log: [], timer: null, lotes: 0,
      fator: 5 / n, tatica: {}, esconde: /Esconder/.test(o.nota || ""),
    };
    st.totalFila = Object.values(pool).reduce((s, x) => s + x.length, 0);
    st.faixa = Object.fromEntries(Object.entries(pool).map(([g, l]) => [g, l.length ? [Math.min(...l.map((j) => j.ovr)), Math.max(...l.map((j) => j.ovr))] : [70, 90]]));
    st.baseIds = base; // pra sortear os reservas depois
    this._proximo(st, ctx);
    return st;
  },
  _time(st, id) { return st.times.find((t) => t.id === id); },
  // cada time tem a SUA formação (dá pra trocar no meio do leilão, igual no 100pracada)
  _falta(st, t, g) { return (t.form || st.form)[g] - t.elenco.filter((j) => (j.slot || j.grupo) === g).length; },
  _cabe(t, esq) { return !!encaixe(t.elenco, esqParaForm(esq)); },
  _cabeJ(t, j) { return !!encaixe([...t.elenco, j], t.form); }, // esse jogador entra no meu time (em alguma vaga)?
  _arruma(t) { const e = encaixe(t.elenco, t.form); if (e) t.elenco.forEach((j, i) => (j.slot = e[i])); },
  _cheio(st, t) { return t.elenco.length >= st.n; },
  _max(st, t) { return t.dinheiro - (st.n - t.elenco.length - 1); },
  _base(st, ovr) { return Math.max(1, Math.round((Math.pow(Math.max(0, ovr - 68), 1.55) / 2.2) * st.fator)); },
  // faltou jogador (ninguém quis / acabou a fila): entra de graça um jogador DE VERDADE mediano, não um "Base 58"
  _completar(st, so) {
    const usados = new Set(st.times.flatMap((t) => t.elenco.map((j) => j.id)));
    for (const t of st.times) for (const g of so ? [so] : ["GOL", "DEF", "MEI", "ATA"]) while (this._falta(st, t, g) > 0) {
      const cands = [...(st.pool[g] || []), ...(st.naoVendidos || []).filter((j) => j.grupo === g), ...((st.reserva && st.reserva[g]) || [])].filter((j) => !usados.has(j.id));
      cands.sort((a, b) => a.ovr - b.ovr);
      const j = cands.length ? cands[Math.floor(cands.length * rnd(0.35, 0.65))] : null;
      if (j) { usados.add(j.id); t.elenco.push({ ...j, preco: 0, slot: g }); st.log.unshift(`${t.nome} completou com ${j.nome} (de graça)`); continue; }
      const v = 70; t.elenco.push({ id: -1, nome: "Base " + g, pos: g, grupo: g, grupos: [g], slot: g, ovr: v, pac: v, sho: v, pas: v, dri: v, def: v, phy: v, clube: "Sub-20", liga: "", flag: "🏳️", preco: 0 });
    }
  },
  // ---------------- LEILÃO ----------------
  _proximo(st, ctx) {
    if (st.times.every((t) => this._cheio(st, t))) return this._iniciaReservas(st, ctx);
    const need = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
    for (const t of st.times) for (const g in need) if (this._max(st, t) >= 1) need[g] += Math.max(0, this._falta(st, t, g));
    const tot = Object.values(need).reduce((s, x) => s + x, 0);
    if (!tot || st.lotes > 500) { this._completar(st); return this._iniciaReservas(st, ctx); }
    let r = Math.random() * tot, g = "ATA";
    for (const k in need) { r -= need[k]; if (r <= 0) { g = k; break; } }
    const P = st.pool[g];
    // acabou a fila dessa posição (gente que ninguém quis): puxa o próximo titular bom que ficou de fora
    // (no máximo 1 por time no leilão todo, pra não virar fila infinita)
    if (!P.length && st.reserva && st.reserva[g].length && (st.puxados = (st.puxados || 0) + 1) <= st.times.length) P.push(st.reserva[g].shift());
    if (!P.length) { this._completar(st, g); return this._proximo(st, ctx); }
    const precisam = st.times.filter((t) => !this._cheio(st, t) && this._falta(st, t, g) > 0);
    st.precisamN = precisam.length;
    const teto = Math.max(1, ...precisam.map((t) => this._max(st, t)));
    let idx = Math.floor(P.length * Math.pow(Math.random(), 2.2));
    if (this._base(st, P[idx].ovr) > teto) { // quem precisa está sem grana: vem um jogador que cabe no bolso
      const ok = P.map((p, i) => i).filter((i) => this._base(st, P[i].ovr) <= teto);
      if (ok.length) idx = ok[Math.floor(ok.length * Math.pow(Math.random(), 1.5))];
    }
    const j = P.splice(idx, 1)[0];
    st.lotes++;
    st.lote = { j, preco: 1 /* todo jogador começa em R$ 1 */, lider: null, fim: ctx.now() + st.tempo, passou: [], vendido: false, hist: [] };
    st.timer = ctx.later(st.tempo, () => this._fechar(st, ctx));
    this._botsPensam(st, ctx);
  },
  // ---------------- RESERVAS ----------------
  // 3 reservas por time (1 DEF, 1 MEI, 1 ATA), sorteados entre jogadores bons mas não craques (82–86).
  // Cada um escolhe o seu e dá um lance com o dinheiro que sobrou; se dois querem o mesmo, leva quem deu mais
  // e o outro escolhe de novo na rodada seguinte (ninguém fica travado).
  _iniciaReservas(st, ctx) {
    st.lote = null; st.fase = "reservas";
    const usados = new Set(st.times.flatMap((t) => t.elenco.map((j) => j.id)));
    const livres = (st.baseIds || []).filter((j) => !usados.has(j.id));
    const cands = {};
    for (const g of RES_GRUPOS) {
      const k = st.times.length + 2;
      let lo = TOPO - 9, hi = TOPO - 5, lista = [];
      while (lo > 55) { lista = livres.filter((j) => j.grupo === g && j.ovr >= lo && j.ovr <= hi); if (lista.length >= k) break; lo--; }
      cands[g] = shuffle(lista).slice(0, k).sort((a, b) => b.ovr - a.ovr);
    }
    for (const t of st.times) t.banco = [];
    st.res = { cands, rodada: 0, escolhas: {}, log: [] };
    this._rodadaReservas(st, ctx);
  },
  _precisaRes(t) { return RES_GRUPOS.filter((g) => !(t.banco || []).some((j) => j.slotRes === g)); },
  _rodadaReservas(st, ctx) {
    const R = st.res;
    ctx.cancel(R.timer);
    const faltam = st.times.filter((t) => this._precisaRes(t).length);
    if (!faltam.length || R.rodada > 12) return this._fimReservas(st, ctx);
    R.rodada++; R.escolhas = {}; R.prontos = [];
    // bots escolhem na hora: o melhor que sobrou, com um lancezinho
    for (const t of faltam.filter((x) => x.bot)) {
      R.escolhas[t.id] = {};
      for (const g of this._precisaRes(t)) { const c = R.cands[g][0]; if (c) R.escolhas[t.id][g] = { id: c.id, lance: Math.floor(rnd(0, Math.min(5, t.dinheiro / 3) + 1)) }; }
      R.prontos.push(t.id);
    }
    const humanos = faltam.filter((t) => !t.bot);
    if (!humanos.length) return this._resolveReservas(st, ctx);
    R.fim = ctx.now() + 30000;
    R.timer = ctx.later(30000, () => this._resolveReservas(st, ctx));
  },
  _resolveReservas(st, ctx) {
    const R = st.res; ctx.cancel(R.timer);
    for (const g of RES_GRUPOS) {
      const porCand = {};
      for (const [tid, esc] of Object.entries(R.escolhas)) if (esc[g]) (porCand[esc[g].id] = porCand[esc[g].id] || []).push({ tid, lance: esc[g].lance });
      for (const [cid, lances] of Object.entries(porCand)) {
        const c = R.cands[g].find((x) => String(x.id) === cid); if (!c) continue;
        const ok = lances.map((l) => ({ ...l, t: this._time(st, l.tid) })).filter((l) => l.t && this._precisaRes(l.t).includes(g));
        if (!ok.length) continue;
        ok.forEach((l) => (l.lance = Math.max(0, Math.min(l.t.dinheiro, Math.floor(+l.lance || 0)))));
        const top = Math.max(...ok.map((l) => l.lance)), venc = shuffle(ok.filter((l) => l.lance === top))[0];
        venc.t.dinheiro -= venc.lance; venc.t.banco.push({ ...c, slotRes: g, slot: g, preco: venc.lance });
        R.cands[g] = R.cands[g].filter((x) => x.id !== c.id);
        R.log.unshift(`${venc.t.nome} pegou ${c.nome} (${c.ovr}) de reserva${venc.lance ? ` por R$ ${venc.lance}` : ""}${ok.length > 1 ? ` — disputou com ${ok.length - 1}` : ""}`);
      }
    }
    R.log = R.log.slice(0, 10);
    this._rodadaReservas(st, ctx);
  },
  _fimReservas(st, ctx) {
    // quem ficou sem (acabou a lista): ganha um da sobra, de graça
    const usados = new Set(st.times.flatMap((t) => [...t.elenco, ...(t.banco || [])].map((j) => j.id)));
    for (const t of st.times) for (const g of this._precisaRes(t)) {
      const c = shuffle((st.baseIds || []).filter((j) => j.grupo === g && !usados.has(j.id) && j.ovr <= TOPO - 5))[0];
      if (c) { usados.add(c.id); t.banco.push({ ...c, slotRes: g, slot: g, preco: 0 }); }
    }
    this._fimLeilao(st, ctx);
  },
  _fimLeilao(st, ctx) {
    st.lote = null; st.fase = "times";
    // a formação montada no leilão vira a formação do primeiro jogo
    for (const t of st.times) st.tatica[t.id] = { form: t.esq || ESQUEMAS[st.n][0], estilo: "Equilibrado", postura: "Equilibrada" };
  },
  _fechar(st, ctx) {
    const L = st.lote; if (!L || L.vendido) return;
    ctx.cancel(st.timer); L.vendido = true;
    if (L.lider) {
      const t = this._time(st, L.lider);
      t.dinheiro -= L.preco; t.elenco.push({ ...L.j, preco: L.preco }); this._arruma(t);
      st.log.unshift(`${t.nome} levou ${L.j.nome}${st.esconde ? "" : ` (${L.j.ovr})`} por R$ ${L.preco}`);
    } else { st.log.unshift(`Ninguém quis ${L.j.nome}${st.esconde ? "" : ` (${L.j.ovr})`}`); (st.naoVendidos = st.naoVendidos || []).push(L.j); }
    st.log = st.log.slice(0, 6);
    L.fim = ctx.now() + 2200;
    st.timer = ctx.later(RAPIDO ? 300 : 2200, () => this._proximo(st, ctx));
  },
  _pode(st, t, valor) { return !this._cheio(st, t) && this._cabeJ(t, st.lote.j) && this._max(st, t) >= valor; },
  // quem caiu passa a vez no lote automaticamente (ninguém fica esperando o timer à toa)
  tick(st, ctx) {
    if (st.fase === "reservas" && st.res && st.res.prontos) { // todo mundo conectado já confirmou? resolve
      const faltam = st.times.filter((x) => !x.bot && this._precisaRes(x).length && !st.res.prontos.includes(x.id) && ctx.online(x.id));
      const algum = st.times.some((x) => !x.bot && this._precisaRes(x).length);
      if (algum && !faltam.length && st.res.prontos.some((id) => !id.startsWith("bot"))) { this._resolveReservas(st, ctx); return true; }
      return false;
    }
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
  // inc: quanto somar (+1/+5/+10); valor: lance exato ("Outro valor" / "Tudo")
  _lance(st, t, inc, ctx, valorExato) {
    const L = st.lote;
    const minimo = L.lider ? L.preco + 1 : L.preco;
    let valor = valorExato ? Math.floor(Number(valorExato)) : L.lider ? L.preco + Math.max(1, Number(inc) || 1) : L.preco + Math.max(0, Number(inc) || 0);
    if (!(valor >= minimo)) return `O lance tem que ser pelo menos R$ ${minimo}`;
    if (valor > this._max(st, t)) return `Você só pode dar até R$ ${this._max(st, t)}`;
    L.preco = valor; L.lider = t.id; L.passou = L.passou.filter((x) => x !== t.id);
    L.hist = [{ nome: t.nome, valor }, ...(L.hist || [])].slice(0, 4);
    const dur = Math.min(st.tempo, MARTELO);
    L.fim = ctx.now() + dur;
    ctx.cancel(st.timer); st.timer = ctx.later(dur, () => this._fechar(st, ctx));
    this._checaPasses(st, ctx);
    if (!L.vendido) this._botsPensam(st, ctx);
  },
  // Quanto o bot paga: divide o dinheiro pelas vagas que faltam e ajusta pela qualidade do jogador
  // DENTRO da fila (o melhor da fila vale ~2 vagas, o pior ~meia vaga). Nunca torra mais de ~40% num jogador
  // só (a não ser que seja a última vaga), dá lance em todo tipo de jogador, e não paga caro por jogador fraco.
  _tetoBot(st, t, j) {
    const g = j.slot || j.grupo, [lo, hi] = st.faixa[g] || [70, 90];
    const q = Math.max(0, Math.min(1, (j.ovr - lo) / Math.max(1, hi - lo)));
    const vagas = st.n - t.elenco.length, porVaga = t.dinheiro / vagas;
    let mult = 0.45 + 1.5 * Math.pow(q, 1.6);
    const sobra = (st.pool[j.grupo] || []).length, precisam = st.precisamN || 1;
    if (sobra < precisam) mult *= 1.3; // tá acabando gente dessa posição
    if (q < 0.25 && sobra > precisam * 1.5) mult = Math.min(mult, 0.25); // fraco e tem bastante opção: só se sair barato
    let teto = Math.round(porVaga * mult * (0.85 + t.estilo * 0.3));
    if (vagas > 1) teto = Math.min(teto, Math.round(t.dinheiro * 0.4));
    return Math.max(1, Math.min(this._max(st, t), teto));
  },
  _botsPensam(st, ctx) {
    const L = st.lote;
    for (const t of st.times.filter((x) => x.bot)) {
      if (t.id === L.lider || L.passou.includes(t.id)) continue;
      if (!this._pode(st, t, L.lider ? L.preco + 1 : L.preco)) { L.passou.push(t.id); continue; }
      // quanto o bot acha que vale: base do jogador × apetite, limitado pelo dinheiro por vaga
      if (!L.teto) L.teto = {};
      if (L.teto[t.id] === undefined) L.teto[t.id] = this._tetoBot(st, t, L.j);
      ctx.later(RAPIDO ? rnd(80, 300) : rnd(700, Math.min(st.tempo - 2000, 3000)), () => {
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
  // ---------------- CAMPEONATO (partida ao vivo) ----------------
  // Cada jogo guarda o estado de cada time: quem está em campo (com estamina, cartões),
  // o banco (3 reservas) e as trocas. Lesão e expulsão valem só pro jogo.
  _estado(st, t) {
    return {
      campo: t.elenco.map((j) => ({ j, slot: j.slot || j.grupo, est: 100, am: 0, fora: null, aviso: false })),
      banco: (t.banco || []).map((j) => ({ j, usado: false })), trocas: 0,
    };
  },
  _ativos(E) { return E.campo.filter((x) => !x.fora); },
  _forca(st, E) {
    const at = this._ativos(E);
    const fat = (x) => 0.72 + 0.28 * Math.min(1, x.est / 55); // cansado rende menos
    const by = (g) => at.filter((x) => x.slot === g);
    const ata = by("ATA").map((x) => (x.j.sho * 0.45 + x.j.pac * 0.3 + x.j.dri * 0.25) * fat(x));
    const mei = by("MEI").map((x) => (x.j.pas * 0.4 + x.j.dri * 0.35 + x.j.sho * 0.25) * fat(x));
    const def = by("DEF").map((x) => (x.j.def * 0.6 + x.j.phy * 0.4) * fat(x));
    const golX = by("GOL")[0];
    const gol = golX ? golX.j.ovr * fat(golX) : 45; // sem goleiro: um de linha vai pro gol
    const falta = st.n - at.length, pen = 1 - Math.min(0.25, falta * (0.3 / Math.max(4, st.n - 1)));
    return {
      ataque: (avg([...ata, ...ata, ...mei]) || 50) * pen,
      defesa: (avg([...def, ...def, gol, gol]) || 50) * pen,
      geral: (avg(at.map((x) => x.j.ovr * fat(x))) || 50) * pen,
      goleiro: gol, golX,
    };
  },
  _sorteia(lista, peso) {
    const w = lista.map((x) => Math.max(0, peso(x))), tot = w.reduce((s, x) => s + x, 0);
    if (!tot) return lista[0];
    let r = Math.random() * tot; for (let i = 0; i < lista.length; i++) { r -= w[i]; if (r <= 0) return lista[i]; } return lista[0];
  },
  _ev(g, e) { const x = { m: Math.min(g.min || 0, 120), ...e }; g.ev.unshift(x); g.ev = g.ev.slice(0, 40); if (x.gol && x.autor) (g.todosGols = g.todosGols || []).push(x); },
  _novaRodada(st, pares, mata, titulo, ctx) {
    st.fase = "aovivo"; st.titulo = titulo; st.mata = mata; st.pausa = null; st.pend = [];
    st.jogos = pares.map(([a, b]) => ({ a, b, ga: 0, gb: 0, ev: [], fim: false, pen: null, prorr: false, min: 0, bola: { x: 50, y: 50 }, posse: "a",
      E: { a: this._estado(st, this._time(st, a)), b: this._estado(st, this._time(st, b)) } }));
    for (const g of st.jogos) this._ev(g, { t: `Rola a bola! ${this._time(st, g.a).nome} x ${this._time(st, g.b).nome}`, tipo: "info" });
    st.min = 0;
    const tick = () => {
      if (st.fase !== "aovivo") return;
      // pausa só pra troca OBRIGATÓRIA de quem é humano (cansado <20 ou machucado) — o relato não para o jogo
      if (this._pausaPendente(st, ctx)) return;
      st.min++;
      let rodando = false;
      for (const g of st.jogos) {
        if (g.fim) continue;
        if (st.min > 90 && !(mata && g.ga === g.gb)) { g.fim = true; this._ev(g, { t: `🏁 Fim de jogo: ${g.ga} x ${g.gb}`, tipo: "info" }); continue; }
        if (st.min > 90 && !g.prorr) { g.prorr = true; this._ev(g, { t: "⏱ Empate! Prorrogação com GOL DE OURO", tipo: "info" }); }
        g.min = st.min;
        this._minuto(st, g, ctx);
        if (g.prorr && g.ga !== g.gb) { g.fim = true; this._ev(g, { t: "⚡ GOL DE OURO! Acabou!", tipo: "info" }); continue; }
        if (st.min >= 120) { g.fim = true; this._penaltis(st, g); continue; }
        rodando = true;
      }
      for (const t of st.times.filter((x) => x.bot)) this._botTatica(st, t);
      if (!rodando) return this._fimRodada(st, ctx);
      if (st.min === 45) { // intervalo: dá pra trocar e mudar a tática
        st.intervalo = ctx.now() + 12000; st.prontos2t = [];
        for (const g of st.jogos) this._ev(g, { t: `⏸ Intervalo: ${g.ga} x ${g.gb}`, tipo: "info" });
        st.tIntervalo = ctx.later(12000, () => { st.intervalo = null; tick(); });
        return;
      }
      st.timerJogo = ctx.later(TICK, tick);
    };
    st.tick = tick;
    st.timerJogo = ctx.later(1500, tick);
  },
  // troca obrigatória pendente de um humano? pausa (12s) até ele escolher, senão troca sozinho
  _pausaPendente(st, ctx) {
    if (st.pausa) return true;
    while (st.pend.length) {
      const p = st.pend.shift();
      const g = st.jogos[p.gi], E = g.E[p.lado], x = E.campo[p.ci];
      if (!x || x.fora && x.fora !== "lesao" || g.fim) continue;
      if (!E.banco.some((b) => !b.usado)) continue;
      const t = this._time(st, p.tid);
      if (t.bot || !ctx.online(t.id)) { this._trocaAuto(st, g, p.lado, p.ci); continue; }
      st.pausa = { ...p, fim: ctx.now() + 12000 };
      st.timerPausa = ctx.later(12000, () => { if (st.pausa) { const q = st.pausa; st.pausa = null; this._trocaAuto(st, st.jogos[q.gi], q.lado, q.ci); st.tick(); } });
      return true;
    }
    return false;
  },
  _trocaAuto(st, g, lado, ci) {
    const E = g.E[lado], sai = E.campo[ci];
    const livres = E.banco.filter((b) => !b.usado);
    if (!livres.length) return;
    const entra = livres.find((b) => gruposDe(b.j).includes(sai.slot)) || livres[0];
    this._troca(st, g, lado, ci, entra.j.id);
  },
  _troca(st, g, lado, ci, entraId) {
    const E = g.E[lado], sai = E.campo[ci], b = E.banco.find((x) => !x.usado && x.j.id === entraId);
    if (!sai || !b) return "Não dá pra fazer essa troca";
    if (sai.fora && sai.fora !== "lesao") return "Esse jogador já saiu";
    b.usado = true; E.trocas++;
    const lesionado = sai.fora === "lesao";
    sai.fora = sai.fora || "sub";
    E.campo.push({ j: b.j, slot: sai.slot, est: 100, am: 0, fora: null, aviso: false, entrou: g.min });
    const T = this._time(st, lado === "a" ? g.a : g.b);
    this._ev(g, { t: `🔁 ${T.nome}: sai ${sai.j.nome}${lesionado ? " (machucado)" : sai.est < 25 ? " (cansado)" : ""}, entra ${b.j.nome}`, tipo: "sub", lado, foto: temFoto(b.j) });
  },
  _minuto(st, g) {
    const A = this._time(st, g.a), B = this._time(st, g.b);
    const fa = this._forca(st, g.E.a), fb = this._forca(st, g.E.b);
    const [atkA, conA] = taticaMult(st.n, st.tatica[g.a], st.tatica[g.b]), [atkB, conB] = taticaMult(st.n, st.tatica[g.b], st.tatica[g.a]);
    const casa = st.mata ? 0 : 0.12;
    const la = (1.2 * Math.exp((fa.ataque - fb.defesa) / 14 + (fa.geral - fb.geral) / 22) + casa) * atkA * conB;
    const lb = (1.1 * Math.exp((fb.ataque - fa.defesa) / 14 + (fb.geral - fa.geral) / 22)) * atkB * conA;
    // 1) estamina: todo mundo cansa; quem ataca mais cansa mais
    for (const [lado, T] of [["a", A], ["b", B]]) {
      const E = g.E[lado], tat = st.tatica[T.id];
      const extra = { Retranca: -0.15, Defensiva: -0.08, Equilibrada: 0, Ofensiva: 0.12, "Tudo pro ataque": 0.25 }[tat.postura] || 0;
      for (const x of this._ativos(E)) {
        const d = (0.74 + extra + (75 - x.j.phy) / 220 + rnd(-0.12, 0.16)) * (x.slot === "GOL" ? 0.35 : 1) * (g.prorr ? 1.15 : 1);
        x.est = Math.max(0, x.est - Math.max(0.2, d));
        if (x.est < 20 && !x.aviso) {
          x.aviso = true;
          if (E.banco.some((b) => !b.usado)) {
            this._ev(g, { t: `🥵 ${x.j.nome} está sem gás (${Math.round(x.est)}%) — tem que sair!`, tipo: "info", lado });
            st.pend.push({ gi: st.jogos.indexOf(g), lado, ci: E.campo.indexOf(x), tid: T.id, motivo: "cansado" });
          } else this._ev(g, { t: `🥵 ${x.j.nome} está morto em campo, mas ${T.nome} não tem mais trocas`, tipo: "info", lado });
        }
      }
    }
    // 2) ataques e gols
    let ataque = null;
    for (const [T, l, fAdv, lado] of [[A, la, fb, "a"], [B, lb, fa, "b"]]) {
      if (Math.random() < (l / 90) * 2.3) {
        ataque = lado;
        const E = g.E[lado], at = this._ativos(E);
        const x = this._sorteia(at, (y) => (y.slot === "ATA" ? y.j.sho : y.slot === "MEI" ? y.j.sho * 0.5 : y.slot === "DEF" ? y.j.sho * 0.12 : 0) * (0.7 + 0.3 * y.est / 100));
        const j = x && x.j;
        const conv = Math.min(0.75, Math.max(0.2, 0.43 * ((j ? j.sho : 60) / 78) * (78 / fAdv.goleiro)));
        const dir = lado === "a" ? 1 : -1;
        if (Math.random() < conv) {
          if (lado === "a") g.ga++; else g.gb++;
          g.bola = { x: lado === "a" ? 97 : 3, y: rnd(42, 58) };
          const ass = this._sorteia(at.filter((y) => y !== x), (y) => (y.slot === "MEI" ? y.j.pas : y.slot === "ATA" ? y.j.pas * 0.6 : y.j.pas * 0.2));
          this._ev(g, { t: `⚽ GOOOL! ${j ? j.nome : "Gol contra"} (${T.nome})${ass && Math.random() < 0.7 ? ` — passe de ${ass.j.nome}` : ""}`, tipo: "gol", gol: true, lado, autor: j ? j.nome : null, time: T.nome, foto: j ? temFoto(j) : null, placar: `${g.ga} x ${g.gb}` });
        } else {
          g.bola = { x: 50 + dir * rnd(30, 44), y: rnd(25, 75) };
          const r = Math.random();
          const gk = fAdv.golX ? fAdv.golX.j.nome : "a defesa";
          if (r < 0.4) this._ev(g, { t: `🧤 ${j ? j.nome : T.nome} chutou e ${gk} defendeu!`, tipo: "chance", lado });
          else if (r < 0.6) this._ev(g, { t: `😱 ${j ? j.nome : T.nome} na trave!`, tipo: "chance", lado });
          else if (r < 0.75) this._ev(g, { t: `🚩 Escanteio pro ${T.nome}`, tipo: "lance", lado });
          else if (r < 0.85) this._ev(g, { t: `🚫 ${j ? j.nome : T.nome} em impedimento`, tipo: "lance", lado });
        }
        g.posse = lado;
      }
    }
    if (!ataque) { // bola rolando no meio
      g.posse = Math.random() < fa.geral / (fa.geral + fb.geral) ? "a" : "b";
      const dir = g.posse === "a" ? 1 : -1;
      g.bola = { x: Math.max(8, Math.min(92, 50 + dir * rnd(-8, 26))), y: rnd(15, 85) };
    }
    // 3) faltas, cartões e lesões
    if (Math.random() < 0.2) {
      const lado = Math.random() < 0.5 ? "a" : "b", outro = lado === "a" ? "b" : "a";
      const E = g.E[lado], at = this._ativos(E);
      const x = this._sorteia(at, (y) => (y.slot === "DEF" ? 3 : y.slot === "MEI" ? 2 : y.slot === "ATA" ? 1 : 0.1));
      const vit = this._sorteia(this._ativos(g.E[outro]), (y) => (y.slot === "ATA" ? 3 : y.slot === "MEI" ? 2 : 1));
      if (x && vit) {
        const T = this._time(st, lado === "a" ? g.a : g.b);
        const r = Math.random();
        if (r < 0.004) { x.fora = "vermelho"; this._ev(g, { t: `🟥 EXPULSO! ${x.j.nome} (${T.nome}) entrou feio em ${vit.j.nome}`, tipo: "vermelho", lado }); }
        else if (r < 0.11) {
          x.am++;
          if (x.am >= 2) { x.fora = "vermelho"; this._ev(g, { t: `🟨🟥 Segundo amarelo! ${x.j.nome} (${T.nome}) está fora do jogo`, tipo: "vermelho", lado }); }
          else this._ev(g, { t: `🟨 Amarelo pra ${x.j.nome} (${T.nome}), falta em ${vit.j.nome}`, tipo: "amarelo", lado });
        } else if (Math.random() < 0.45) this._ev(g, { t: `Falta de ${x.j.nome} em ${vit.j.nome}`, tipo: "falta", lado });
        g.bola = { x: Math.max(10, Math.min(90, g.bola.x + rnd(-10, 10))), y: rnd(20, 80) };
      }
    }
    for (const [lado, T] of [["a", A], ["b", B]]) {
      const E = g.E[lado];
      for (const x of this._ativos(E)) if (Math.random() < 0.0004) {
        x.fora = "lesao";
        const tem = E.banco.some((b) => !b.usado);
        this._ev(g, { t: `🚑 ${x.j.nome} (${T.nome}) se machucou${tem ? " e vai ter que sair" : " — sem trocas, o time fica com um a menos"}`, tipo: "lesao", lado });
        if (tem) st.pend.push({ gi: st.jogos.indexOf(g), lado, ci: E.campo.indexOf(x), tid: T.id, motivo: "machucado" });
      }
    }
  },
  _penaltis(st, g) {
    const ka = this._forca(st, g.E.a).goleiro, kb = this._forca(st, g.E.b).goleiro;
    let pa = 0, pb = 0, i = 0; const pA = 0.75 - (kb - 75) / 150, pB = 0.75 - (ka - 75) / 150;
    while (i < 5 || pa === pb) { if (Math.random() < pA) pa++; if (Math.random() < pB) pb++; i++; if (i > 30) { pa++; break; } }
    g.pen = [pa, pb]; this._ev(g, { t: `🥅 Pênaltis: ${pa} x ${pb}`, tipo: "info" });
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
      for (const e of g.todosGols || []) { const k = e.autor + "|" + e.time; st.gols[k] = st.gols[k] || { nome: e.autor, time: e.time, gols: 0 }; st.gols[k].gols++; }
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
      if (!this._cabeJ(t, L.j)) return `Não tem vaga pra ele na sua formação — troque a formação`;
      if (L.lider === pid) return "Você já está ganhando";
      const exato = a.tudo ? this._max(st, t) : a.valor;
      return this._lance(st, t, a.inc, ctx, exato);
    }
    if (a.type === "formacao" && st.fase === "leilao" && t) {
      if (!ESQUEMAS[st.n].includes(a.esq)) return;
      if (!this._cabe(t, a.esq)) return "Seus jogadores não cabem nessa formação";
      t.esq = a.esq; t.form = esqParaForm(a.esq); this._arruma(t);
      if (st.lote && !st.lote.vendido) this._checaPasses(st, ctx);
      return;
    }
    if (a.type === "reserva" && st.fase === "reservas" && t) {
      const R = st.res; if (!RES_GRUPOS.includes(a.g) || !this._precisaRes(t).includes(a.g)) return;
      const c = R.cands[a.g].find((x) => x.id === a.id); if (!c) return "Esse já foi";
      R.escolhas[pid] = R.escolhas[pid] || {};
      R.escolhas[pid][a.g] = { id: c.id, lance: Math.max(0, Math.min(t.dinheiro, Math.floor(+a.lance || 0))) };
      R.prontos = (R.prontos || []).filter((x) => x !== pid);
      return;
    }
    if (a.type === "reservaPronto" && st.fase === "reservas" && t) {
      const R = st.res;
      if (!R.prontos.includes(pid)) R.prontos.push(pid);
      const faltam = st.times.filter((x) => !x.bot && this._precisaRes(x).length && !R.prontos.includes(x.id) && ctx.online(x.id));
      if (!faltam.length) this._resolveReservas(st, ctx);
      return;
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
    if (a.type === "sub" && st.fase === "aovivo") {
      const gi = st.jogos.findIndex((g) => !g.fim && (g.a === pid || g.b === pid)); if (gi < 0) return;
      const g = st.jogos[gi], lado = g.a === pid ? "a" : "b", E = g.E[lado];
      const ci = E.campo.findIndex((x) => x.j.id === a.sai && (!x.fora || x.fora === "lesao"));
      if (ci < 0) return "Esse jogador não está em campo";
      const r = this._troca(st, g, lado, ci, a.entra); if (r) return r;
      if (st.pausa && st.pausa.gi === gi && st.pausa.lado === lado) { ctx.cancel(st.timerPausa); st.pausa = null; st.pend = st.pend.filter((p) => !(p.gi === gi && p.lado === lado && E.campo[p.ci].fora)); st.tick(); }
      return;
    }
    if (a.type === "segundoTempo" && st.fase === "aovivo" && st.intervalo) {
      st.prontos2t = st.prontos2t || []; if (!st.prontos2t.includes(pid)) st.prontos2t.push(pid);
      const humanos = st.times.filter((x) => !x.bot && ctx.online(x.id));
      if (humanos.every((x) => st.prontos2t.includes(x.id))) { ctx.cancel(st.tIntervalo); st.intervalo = null; st.tick(); }
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
  view(st, pid, ctx) {
    const me = this._time(st, pid);
    // modo "nota escondida": durante o leilão ninguém vê overall nem atributos (tem que conhecer o jogador!)
    const oculto = st.esconde && st.fase === "leilao";
    const pj = (j) => { const x = pub(j); if (x && oculto) { for (const k of ["ovr", "pac", "sho", "pas", "dri", "def", "phy"]) x[k] = null; } return x; };
    const L0 = st.fase === "leilao" ? st.lote : null;
    const times = st.times.map((t) => ({
      id: t.id, nome: t.nome, bot: t.bot, dinheiro: t.dinheiro, elenco: t.elenco.map(pj), r: oculto ? null : ratings(t), esq: t.esq, form: t.form || st.form,
      falta: Object.fromEntries(["GOL", "DEF", "MEI", "ATA"].map((g) => [g, this._falta(st, t, g)])),
      tag: !L0 ? "" : this._cheio(st, t) ? "completo" : L0.lider === t.id ? "lidera" : !t.bot && ctx && !ctx.online(t.id) ? "ausente" : L0.passou.includes(t.id) ? "passou" : "",
    }));
    const v = { fase: st.fase, n: st.n, form: st.form, base: st.base, formato: st.formato, times, log: st.log, tempo: st.tempo, orc: ORC, oculto, esquemas: ESQUEMAS[st.n], apelidos: APELIDO_ESQ };
    if (st.fase === "leilao" && st.lote) {
      const L = st.lote;
      v.lote = { j: pj(L.j), preco: L.preco, lider: L.lider, liderNome: L.lider ? this._time(st, L.lider).nome : null, fim: L.fim, vendido: L.vendido, passei: L.passou.includes(pid), hist: L.hist || [] };
      v.restantes = Object.values(st.pool).reduce((s, x) => s + x.length, 0);
      v.numLote = st.lotes; v.totalLotes = Math.max(st.totalFila || 0, st.lotes + v.restantes);
      if (me) {
        v.meuMax = this._max(st, me); v.cheio = this._cheio(st, me); v.precisoDessa = this._cabeJ(me, L.j);
        v.minhaEsq = me.esq;
        v.esqOk = ESQUEMAS[st.n].filter((e) => this._cabe(me, e));
      }
    }
    for (const tv of v.times) { const t = this._time(st, tv.id); tv.banco = (t.banco || []).map(pub); }
    if (st.fase === "reservas") {
      const R = st.res;
      v.res = { rodada: R.rodada, fim: R.fim, log: R.log, cands: Object.fromEntries(RES_GRUPOS.map((g) => [g, R.cands[g].map(pub)])),
        minhas: R.escolhas[pid] || {}, preciso: me ? this._precisaRes(me) : [], pronto: (R.prontos || []).includes(pid),
        esperando: st.times.filter((x) => !x.bot && this._precisaRes(x).length && !(R.prontos || []).includes(x.id)).map((x) => x.nome) };
    }
    if (st.tatica[pid]) { v.minhaTatica = st.tatica[pid]; v.estilos = ESTILOS; v.posturas = POSTURAS; }
    if (st.jogos) {
      v.min = st.min; v.titulo = st.titulo; v.mata = st.mata; v.etapa = st.etapa;
      const ladoV = (E) => ({ trocas: E.trocas,
        campo: E.campo.map((x) => ({ id: x.j.id, nome: x.j.nome, foto: temFoto(x.j), ovr: x.j.ovr, pos: x.j.pos, slot: x.slot, est: Math.round(x.est), am: x.am, fora: x.fora })),
        banco: E.banco.map((b) => ({ id: b.j.id, nome: b.j.nome, foto: temFoto(b.j), ovr: b.j.ovr, pos: b.j.pos, grupos: gruposDe(b.j), usado: b.usado })) });
      v.jogos = st.jogos.map((g) => ({ a: g.a, b: g.b, ga: g.ga, gb: g.gb, fim: g.fim, pen: g.pen, prorr: g.prorr, ev: g.ev, bola: g.bola, posse: g.posse,
        tatA: st.tatica[g.a], tatB: st.tatica[g.b], A: ladoV(g.E.a), B: ladoV(g.E.b) }));
      v.intervalo = st.intervalo || null; v.prontoIntervalo = (st.prontos2t || []).includes(pid);
      if (st.pausa) {
        const P = st.pausa, g = st.jogos[P.gi], E = g.E[P.lado], x = E.campo[P.ci];
        v.pausa = { tid: P.tid, nome: this._time(st, P.tid).nome, motivo: P.motivo, fim: P.fim, sai: { id: x.j.id, nome: x.j.nome, est: Math.round(x.est), slot: x.slot },
          opcoes: E.banco.filter((b) => !b.usado).map((b) => ({ id: b.j.id, nome: b.j.nome, foto: temFoto(b.j), ovr: b.j.ovr, pos: b.j.pos, grupos: gruposDe(b.j) })) };
      }
    }
    if (st.tab) { v.tabela = this._classif(st); v.artilharia = this._artilharia(st); v.r = st.r; v.totalRodadas = st.rodadas ? st.rodadas.length : 0; }
    if (st.fase === "intervalo" && st.etapa === "liga" && st.r + 1 >= st.rodadas.length) v.proxTxt = st.formato === "Pontos corridos" ? "Ver campeão 🏆" : "Ir pro mata-mata 🏆";
    if (st.fase === "intervalo" && st.etapa === "mata") v.proxTxt = this._nomeFase(st.vivos.length);
    if (st.fase === "fim") { v.campeao = st.campeao; v.gastouMelhor = this._gastouMelhor(st).slice(0, 3); }
    return v;
  },
};
module.exports._BASES = BASES;

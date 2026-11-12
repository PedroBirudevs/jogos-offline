// Leilão OVER: jogadores reais (EA FC 27) com atributos, times por posição,
// campeonato ida e volta simulado pelos atributos + mata-mata e artilharia.
const DB = require("../data/jogadores.json");
const ALL = DB.rows.map((r, i) => { const o = { id: i }; DB.cols.forEach((c, k) => (o[c] = r[k])); return o; });
const GRANDES = ["Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1"];
const BASES = {
  "Top 100 clubes do mundo": () => ALL.filter((p) => p.ovr >= 70),
  "Só craques (82+)": () => ALL.filter((p) => p.ovr >= 82),
  "5 grandes ligas": () => ALL.filter((p) => GRANDES.includes(p.liga)),
  "Brasileirão": () => ALL.filter((p) => p.liga === "Brasileirão"),
  "Premier League": () => ALL.filter((p) => p.liga === "Premier League"),
  "LaLiga": () => ALL.filter((p) => p.liga === "LaLiga"),
  "Serie A": () => ALL.filter((p) => p.liga === "Serie A"),
  "Bundesliga": () => ALL.filter((p) => p.liga === "Bundesliga"),
  "Ligue 1": () => ALL.filter((p) => p.liga === "Ligue 1"),
};
const FORMACAO = { 5: { GOL: 1, DEF: 2, MEI: 1, ATA: 1 }, 7: { GOL: 1, DEF: 2, MEI: 2, ATA: 2 }, 11: { GOL: 1, DEF: 4, MEI: 3, ATA: 3 } };
const DINHEIRO = { Pouco: 12, Normal: 20, Muito: 30 };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const poisson = (l) => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
const precoBase = (ovr) => Math.max(1, Math.round(Math.pow(Math.max(0, ovr - 68), 1.55) / 2.2));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function ratings(t) {
  const E = t.elenco;
  const by = (g) => E.filter((j) => j.grupo === g);
  const ata = by("ATA").map((j) => j.sho * 0.45 + j.pac * 0.3 + j.dri * 0.25);
  const mei = by("MEI").map((j) => j.pas * 0.4 + j.dri * 0.35 + j.sho * 0.25);
  const def = by("DEF").map((j) => j.def * 0.6 + j.phy * 0.4);
  const gol = by("GOL").map((j) => j.ovr);
  const ataque = avg([...ata, ...ata, ...mei]) || 50;
  const defesa = avg([...def, ...def, ...(gol.length ? gol : [45]), ...(gol.length ? gol : [45])]) || 50;
  const geral = avg(E.map((j) => j.ovr)) || 50;
  return { ataque: Math.round(ataque), defesa: Math.round(defesa), geral: Math.round(geral) };
}
function artilheiro(t) {
  const w = t.elenco.map((j) => ({ j, w: j.grupo === "ATA" ? j.sho : j.grupo === "MEI" ? j.sho * 0.5 : j.grupo === "DEF" ? j.sho * 0.12 : 0 }));
  const tot = w.reduce((s, x) => s + x.w, 0); if (!tot) return null;
  let r = Math.random() * tot; for (const x of w) { r -= x.w; if (r <= 0) return x.j; } return w[0].j;
}
function partida(A, B, casa, mataMata) {
  const ra = ratings(A), rb = ratings(B);
  const la = 1.25 * Math.exp((ra.ataque - rb.defesa) / 14 + (ra.geral - rb.geral) / 22) + (casa ? 0.15 : 0);
  const lb = 1.15 * Math.exp((rb.ataque - ra.defesa) / 14 + (rb.geral - ra.geral) / 22);
  const ga = poisson(la), gb = poisson(lb);
  const golsA = [], golsB = [];
  for (let i = 0; i < ga; i++) { const j = artilheiro(A); golsA.push(j ? { nome: j.nome, id: j.id } : { nome: "Gol contra" }); }
  for (let i = 0; i < gb; i++) { const j = artilheiro(B); golsB.push(j ? { nome: j.nome, id: j.id } : { nome: "Gol contra" }); }
  const r = { a: A.id, b: B.id, ga, gb, golsA, golsB };
  if (mataMata && ga === gb) {
    const ka = (A.elenco.find((j) => j.grupo === "GOL") || { ovr: 50 }).ovr, kb = (B.elenco.find((j) => j.grupo === "GOL") || { ovr: 50 }).ovr;
    let pa = 0, pb = 0, i = 0; const pA = 0.75 - (kb - 75) / 150, pB = 0.75 - (ka - 75) / 150;
    while (i < 5 || pa === pb) { if (Math.random() < pA) pa++; if (Math.random() < pB) pb++; i++; if (i > 30) { pa++; break; } }
    r.pen = [pa, pb];
  }
  r.vencedor = ga > gb ? A.id : gb > ga ? B.id : r.pen ? (r.pen[0] > r.pen[1] ? A.id : B.id) : null;
  return r;
}
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
const pub = (j) => j && { id: j.id, nome: j.nome, pos: j.pos, grupo: j.grupo, ovr: j.ovr, pac: j.pac, sho: j.sho, pas: j.pas, dri: j.dri, def: j.def, phy: j.phy, clube: j.clube, liga: j.liga, flag: j.flag, aprox: !!j.aprox, preco: j.preco };

module.exports = {
  key: "leilao",
  nome: "Leilão OVER",
  emoji: "⚽",
  desc: "Jogadores reais com overall do EA FC 27. Dê lances, monte o time por posição e dispute o campeonato.",
  min: 2,
  opcoes: [
    { id: "base", nome: "Jogadores do leilão", valores: Object.keys(BASES), padrao: "Top 100 clubes do mundo" },
    { id: "elenco", nome: "Tamanho do time", valores: ["5 (1 GOL, 2 DEF, 1 MEI, 1 ATA)", "7 (1 GOL, 2 DEF, 2 MEI, 2 ATA)", "11 (1 GOL, 4 DEF, 3 MEI, 3 ATA)"], padrao: "5 (1 GOL, 2 DEF, 1 MEI, 1 ATA)" },
    { id: "dinheiro", nome: "Dinheiro", valores: ["Pouco", "Normal", "Muito"], padrao: "Normal" },
    { id: "tempo", nome: "Segundos por lance", valores: [6, 8, 12], padrao: 8 },
  ],

  init(list, o, ctx) {
    const n = parseInt(o.elenco) || 5;
    const form = FORMACAO[n] || FORMACAO[5];
    const din = (DINHEIRO[o.dinheiro] || 20) * n;
    const base = (BASES[o.base] || BASES["Top 100 clubes do mundo"])();
    const pool = {};
    for (const g of ["GOL", "DEF", "MEI", "ATA"]) pool[g] = base.filter((p) => p.grupo === g).sort((a, b) => b.ovr - a.ovr);
    const st = {
      fase: "leilao", base: o.base || "Top 100 clubes do mundo", form, n, orc: din, tempo: (Number(o.tempo) || 8) * 1000,
      times: list.map((p) => ({ id: p.id, nome: p.name, dinheiro: din, elenco: [] })),
      pool, lote: null, log: [], timer: null, lotes: 0,
    };
    this._proximo(st, ctx);
    return st;
  },
  _time(st, id) { return st.times.find((t) => t.id === id); },
  _falta(st, t, g) { return st.form[g] - t.elenco.filter((j) => j.grupo === g).length; },
  _cheio(st, t) { return t.elenco.length >= st.n; },
  _max(st, t) { return t.dinheiro - (st.n - t.elenco.length - 1); },
  _completar(st, so) {
    for (const t of st.times) for (const g of so ? [so] : ["GOL", "DEF", "MEI", "ATA"]) while (this._falta(st, t, g) > 0) {
      const v = 58; t.elenco.push({ id: -1, nome: "Base " + g, pos: g, grupo: g, ovr: v, pac: v, sho: v, pas: v, dri: v, def: v, phy: v, clube: "Sub-20", liga: "", flag: "🏳️", preco: 0 });
    }
  },
  _proximo(st, ctx) {
    if (st.times.every((t) => this._cheio(st, t))) { st.lote = null; st.fase = "times"; return; }
    // posição que alguém ainda precisa (peso = quanto falta)
    const need = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
    for (const t of st.times) for (const g in need) if (this._max(st, t) >= 1) need[g] += Math.max(0, this._falta(st, t, g));
    const tot = Object.values(need).reduce((s, x) => s + x, 0);
    if (!tot || st.lotes > 400) { this._completar(st); st.lote = null; st.fase = "times"; return; }
    let r = Math.random() * tot, g = "ATA";
    for (const k in need) { r -= need[k]; if (r <= 0) { g = k; break; } }
    const P = st.pool[g];
    if (!P.length) { this._completar(st, g); return this._proximo(st, ctx); }
    const idx = Math.floor(P.length * Math.pow(Math.random(), 2.2)); // puxa mais os bons
    const j = P.splice(idx, 1)[0];
    st.lotes++;
    st.lote = { j, preco: precoBase(j.ovr), lider: null, fim: ctx.now() + st.tempo + 4000, passou: [], vendido: false };
    st.timer = ctx.later(st.tempo + 4000, () => this._fechar(st, ctx));
  },
  _fechar(st, ctx) {
    const L = st.lote; if (!L || L.vendido) return;
    ctx.cancel(st.timer); L.vendido = true;
    if (L.lider) {
      const t = this._time(st, L.lider);
      t.dinheiro -= L.preco; t.elenco.push({ ...L.j, preco: L.preco });
      st.log.unshift(`${t.nome} levou ${L.j.nome} (${L.j.ovr}) por ${L.preco}M`);
    } else st.log.unshift(`Ninguém quis ${L.j.nome} (${L.j.ovr})`);
    st.log = st.log.slice(0, 6);
    L.fim = ctx.now() + 2500;
    st.timer = ctx.later(2500, () => this._proximo(st, ctx));
  },
  _pode(st, t, valor) { return !this._cheio(st, t) && this._falta(st, t, st.lote.j.grupo) > 0 && this._max(st, t) >= valor; },
  _checaPasses(st, ctx) {
    const L = st.lote;
    const ativos = st.times.filter((t) => t.id !== L.lider && this._pode(st, t, L.lider ? L.preco + 1 : L.preco));
    if (ativos.every((t) => L.passou.includes(t.id))) this._fechar(st, ctx);
  },
  act(st, pid, a, ctx) {
    if (a.type === "lance" && st.fase === "leilao") {
      const L = st.lote, t = this._time(st, pid);
      if (!L || L.vendido) return "Espere o próximo jogador";
      if (!t) return "Você está só assistindo";
      if (this._cheio(st, t)) return "Seu time já está completo";
      if (this._falta(st, t, L.j.grupo) <= 0) return `Você já tem todos os ${L.j.grupo} que precisa`;
      if (L.lider === pid) return "Você já está ganhando";
      const valor = L.lider ? L.preco + Math.max(1, Number(a.inc) || 1) : L.preco;
      if (valor > this._max(st, t)) return `Você só pode dar até ${this._max(st, t)}M`;
      L.preco = valor; L.lider = pid; L.passou = L.passou.filter((x) => x !== pid);
      L.fim = ctx.now() + st.tempo;
      ctx.cancel(st.timer); st.timer = ctx.later(st.tempo, () => this._fechar(st, ctx));
      this._checaPasses(st, ctx);
      return;
    }
    if (a.type === "passar" && st.fase === "leilao") {
      const L = st.lote; if (!L || L.vendido || L.lider === pid) return;
      if (!L.passou.includes(pid)) L.passou.push(pid);
      this._checaPasses(st, ctx); return;
    }
    if (a.type === "campeonato" && st.fase === "times") {
      st.fase = "liga"; st.rodadas = calendario(st.times.map((t) => t.id)); st.r = -1; st.resultados = []; st.gols = {};
      st.tab = Object.fromEntries(st.times.map((t) => [t.id, { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }]));
      return this.act(st, pid, { type: "avancar" }, ctx);
    }
    if (a.type === "avancar") {
      const marca = (g) => { for (const [lista, tid] of [[g.golsA, g.a], [g.golsB, g.b]]) for (const x of lista) if (x.id !== undefined && x.id >= 0) { const k = tid + ":" + x.id; st.gols[k] = st.gols[k] || { nome: x.nome, time: this._time(st, tid).nome, gols: 0 }; st.gols[k].gols++; } };
      if (st.fase === "liga") {
        if (st.r + 1 < st.rodadas.length) {
          st.r++;
          const res = st.rodadas[st.r].map(([x, y]) => partida(this._time(st, x), this._time(st, y), true, false));
          for (const g of res) {
            const A = st.tab[g.a], B = st.tab[g.b];
            A.j++; B.j++; A.gp += g.ga; A.gc += g.gb; B.gp += g.gb; B.gc += g.ga;
            if (g.ga > g.gb) { A.v++; B.d++; A.pts += 3; } else if (g.gb > g.ga) { B.v++; A.d++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
            marca(g);
          }
          st.resultados = res; return;
        }
        const cl = this._classif(st).map((x) => x.id);
        st.fase = "mata"; st.resultados = [];
        st.chave = cl.length >= 4 ? { semis: [[cl[0], cl[3]], [cl[1], cl[2]]], final: null } : { semis: null, final: [cl[0], cl[1]] };
        st.etapa = cl.length >= 4 ? "semis" : "final";
        return;
      }
      if (st.fase === "mata") {
        if (st.etapa === "semis" && !st.resSemis) {
          st.resSemis = st.chave.semis.map(([x, y]) => partida(this._time(st, x), this._time(st, y), false, true));
          st.resSemis.forEach(marca);
          st.chave.final = st.resSemis.map((g) => g.vencedor); return;
        }
        if (!st.resFinal) {
          st.etapa = "final";
          const [x, y] = st.chave.final;
          st.resFinal = partida(this._time(st, x), this._time(st, y), false, true); marca(st.resFinal);
          st.campeao = st.resFinal.vencedor; st.fase = "fim";
          const art = this._artilharia(st)[0];
          ctx.finish({ titulo: `⚽ Campeão: ${this._time(st, st.campeao).nome}${art ? ` · Artilheiro: ${art.nome} (${art.gols})` : ""}`, linhas: this._classif(st).map((x) => ({ nome: x.nome, pontos: x.pts + " pts" })) });
        }
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
    const times = st.times.map((t) => ({ id: t.id, nome: t.nome, dinheiro: t.dinheiro, elenco: t.elenco.map(pub), r: ratings(t), falta: Object.fromEntries(["GOL", "DEF", "MEI", "ATA"].map((g) => [g, this._falta(st, t, g)])) }));
    const v = { fase: st.fase, n: st.n, form: st.form, orc: st.orc, base: st.base, times, log: st.log, tempo: st.tempo };
    if (st.fase === "leilao" && st.lote) {
      const L = st.lote;
      v.lote = { j: pub(L.j), preco: L.preco, lider: L.lider, liderNome: L.lider ? this._time(st, L.lider).nome : null, fim: L.fim, vendido: L.vendido, passei: L.passou.includes(pid) };
      v.restantes = Object.values(st.pool).reduce((s, x) => s + x.length, 0);
      if (me) { v.meuMax = this._max(st, me); v.cheio = this._cheio(st, me); v.precisoDessa = this._falta(st, me, L.j.grupo) > 0; }
    }
    if (st.tab) {
      v.tabela = this._classif(st); v.rodada = st.r + 1; v.totalRodadas = st.rodadas.length; v.resultados = st.resultados;
      v.chave = st.chave; v.resSemis = st.resSemis; v.resFinal = st.resFinal; v.campeao = st.campeao; v.etapa = st.etapa;
      v.artilharia = this._artilharia(st);
    }
    return v;
  },
};

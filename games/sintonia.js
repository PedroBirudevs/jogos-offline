// Sintonia (estilo Wavelength): gira a roleta, dá a dica, todo mundo chuta no ponteiro
const CARTAS = require("../data/sintonia");
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pontos = (d) => (d <= 4 ? 4 : d <= 9 ? 3 : d <= 15 ? 2 : 0);

module.exports = {
  key: "sintonia",
  ordem: 3,
  nome: "Sintonia",
  emoji: "🎯",
  desc: "Um gira a roleta e dá uma dica. Os outros tentam acertar onde o ponteiro parou.",
  min: 2,
  opcoes: [{ id: "voltas", nome: "Vezes que cada um dá a dica", valores: [1, 2, 3], padrao: 2 }],

  init(list, o) {
    const voltas = Number(o.voltas) || 2;
    const ordem = [];
    for (let v = 0; v < voltas; v++) ordem.push(...list.map((p) => p.id));
    const st = { jog: list, ordem, i: -1, cartas: shuffle(CARTAS), pts: Object.fromEntries(list.map((p) => [p.id, 0])) };
    this._nova(st);
    return st;
  },
  _nova(st) {
    st.i++;
    if (st.i >= st.ordem.length) { st.fase = "fim"; return; }
    st.vidente = st.ordem[st.i];
    st.carta = st.cartas[st.i % st.cartas.length];
    st.alvo = null; st.dica = ""; st.chutes = {}; st.fase = "girar"; st.ganhos = null; st.previa = {};
  },
  act(st, pid, a, ctx) {
    if (a.type === "girar" && st.fase === "girar" && pid === st.vidente) { st.alvo = 3 + Math.floor(Math.random() * 95); st.fase = "dica"; return; }
    if (a.type === "trocar" && (st.fase === "girar" || st.fase === "dica") && pid === st.vidente) { st.carta = CARTAS[Math.floor(Math.random() * CARTAS.length)]; return; }
    if (a.type === "dica" && st.fase === "dica" && pid === st.vidente) {
      const d = String(a.dica || "").trim().slice(0, 60); if (!d) return "Escreva a dica";
      st.dica = d; st.fase = "chute"; return;
    }
    if (a.type === "mover" && st.fase === "chute" && pid !== st.vidente && st.pts[pid] !== undefined) {
      st.previa = st.previa || {}; st.previa[pid] = Math.max(0, Math.min(100, Math.round(Number(a.valor)))); return;
    }
    if (a.type === "chute" && st.fase === "chute" && pid !== st.vidente && st.pts[pid] !== undefined) {
      st.chutes[pid] = Math.max(0, Math.min(100, Math.round(Number(a.valor))));
      const faltam = st.jog.filter((p) => p.id !== st.vidente && st.chutes[p.id] === undefined);
      if (!faltam.length) this._revelar(st, ctx);
      return;
    }
    if (a.type === "revelar" && st.fase === "chute") { this._revelar(st, ctx); return; }
    if (a.type === "proxima" && st.fase === "revela") {
      this._nova(st);
      if (st.fase === "fim") this._fim(st, ctx);
      return;
    }
  },
  _revelar(st, ctx) {
    st.ganhos = {};
    const vals = [];
    for (const [id, v] of Object.entries(st.chutes)) { const g = pontos(Math.abs(v - st.alvo)); st.ganhos[id] = g; st.pts[id] += g; vals.push(g); }
    const gv = vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : 0;
    st.ganhos[st.vidente] = gv; st.pts[st.vidente] += gv;
    st.fase = "revela";
  },
  _fim(st, ctx) {
    ctx.finish({ titulo: "🎯 Sintonia — resultado", linhas: this._placar(st).map((x) => ({ nome: x.nome, pontos: x.pts + " pts" })) });
  },
  _placar(st) { return st.jog.map((p) => ({ id: p.id, nome: p.name, pts: st.pts[p.id] })).sort((a, b) => b.pts - a.pts); },
  view(st, pid) {
    const souVidente = pid === st.vidente;
    return {
      fase: st.fase, rodada: st.i + 1, total: st.ordem.length,
      vidente: st.vidente, videnteNome: (st.jog.find((p) => p.id === st.vidente) || {}).name,
      souVidente, carta: st.carta, dica: st.dica,
      alvo: souVidente || st.fase === "revela" ? st.alvo : null,
      meuChute: st.chutes[pid], enviaram: Object.keys(st.chutes).length, precisam: st.jog.length - 1,
      chutes: st.fase === "revela" ? st.jog.filter((p) => st.chutes[p.id] !== undefined).map((p) => ({ nome: p.name, v: st.chutes[p.id], g: st.ganhos[p.id] })) : null,
      ganhoVidente: st.ganhos ? st.ganhos[st.vidente] : null,
      placar: this._placar(st), jogando: st.pts[pid] !== undefined,
      cores: Object.fromEntries(st.jog.map((p, i) => [p.id, ["#4cc3ff", "#ff6b2c", "#c6ff3d", "#ff5d9e", "#ffcf3f", "#9b7bff", "#3ddc84", "#ff5d6c"][i % 8]])),
      // ponteiros dos outros: só quem dá a dica vê (cada um chuta sozinho, sem copiar)
      ao_vivo: st.fase === "chute" && (pid === st.vidente || st.pts[pid] === undefined) ? st.jog.filter((p) => p.id !== pid && p.id !== st.vidente).map((p) => ({ id: p.id, nome: p.name, v: st.chutes[p.id] ?? (st.previa || {})[p.id] ?? null, ok: st.chutes[p.id] !== undefined })) : null,
    };
  },
};

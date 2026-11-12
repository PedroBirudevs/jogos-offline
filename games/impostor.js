// Impostor: todo mundo recebe a mesma palavra, menos o(s) impostor(es)
const PAL = require("../data/palavras");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

module.exports = {
  key: "impostor",
  nome: "Impostor",
  emoji: "🕵️",
  desc: "Todos recebem a mesma palavra, menos o impostor. Cada um fala uma pista e depois votam.",
  min: 3,
  opcoes: [
    { id: "impostores", nome: "Impostores", valores: [1, 2], padrao: 1 },
    { id: "dica", nome: "Impostor vê a categoria?", valores: ["sim", "não"], padrao: "sim" },
  ],
  init(list, o) {
    const st = { jog: list, nImp: Number(o.impostores) || 1, dicaCat: o.dica !== "não", pts: Object.fromEntries(list.map((p) => [p.id, 0])), rodada: 0 };
    this._nova(st);
    return st;
  },
  _nova(st) {
    st.rodada++;
    const cats = Object.keys(PAL);
    st.cat = cats[Math.floor(Math.random() * cats.length)];
    st.palavra = PAL[st.cat][Math.floor(Math.random() * PAL[st.cat].length)];
    const ids = st.jog.map((p) => p.id).sort(() => Math.random() - 0.5);
    st.imp = ids.slice(0, Math.min(st.nImp, Math.max(1, st.jog.length - 2)));
    st.comeca = ids[Math.floor(Math.random() * ids.length)];
    st.fase = "palavra"; st.votos = {}; st.resultado = null; st.chute = null;
  },
  act(st, pid, a, ctx) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    if (a.type === "votacao" && st.fase === "palavra") { st.fase = "votacao"; return; }
    if (a.type === "voto" && st.fase === "votacao" && st.pts[pid] !== undefined) {
      if (a.alvo === pid) return "Não pode votar em você mesmo";
      if (!st.jog.some((p) => p.id === a.alvo)) return;
      st.votos[pid] = a.alvo;
      if (Object.keys(st.votos).length >= st.jog.length) this._apurar(st);
      return;
    }
    if (a.type === "apurar" && st.fase === "votacao") { this._apurar(st); return; }
    if (a.type === "chute" && st.fase === "chuteImpostor" && st.imp.includes(pid)) {
      st.chute = String(a.texto || "").slice(0, 40);
      const acertou = norm(st.chute) && (norm(st.chute) === norm(st.palavra));
      this._final(st, acertou ? "impostor" : "time", acertou ? `${nome(pid)} adivinhou a palavra!` : `${nome(pid)} chutou "${st.chute}" e errou`);
      return;
    }
    if (a.type === "proxima" && st.fase === "fim") { this._nova(st); return; }
    if (a.type === "encerrar") {
      ctx.finish({ titulo: "🕵️ Impostor — resultado", linhas: this._placar(st).map((x) => ({ nome: x.nome, pontos: x.pts + " pts" })) });
      st.fase = "encerrado"; return;
    }
  },
  _apurar(st) {
    const cont = {};
    for (const v of Object.values(st.votos)) cont[v] = (cont[v] || 0) + 1;
    const max = Math.max(0, ...Object.values(cont));
    const top = Object.keys(cont).filter((k) => cont[k] === max);
    st.cont = cont;
    st.eliminado = top.length === 1 ? top[0] : null;
    if (st.eliminado && st.imp.includes(st.eliminado)) st.fase = "chuteImpostor";
    else this._final(st, "impostor", st.eliminado ? "Votaram em um inocente!" : "Deu empate na votação!");
  },
  _final(st, venc, motivo) {
    st.venc = venc; st.motivo = motivo; st.fase = "fim";
    for (const p of st.jog) {
      const isImp = st.imp.includes(p.id);
      if (venc === "impostor" && isImp) st.pts[p.id] += 3;
      if (venc === "time" && !isImp) st.pts[p.id] += 1;
    }
  },
  _placar(st) { return st.jog.map((p) => ({ id: p.id, nome: p.name, pts: st.pts[p.id] })).sort((a, b) => b.pts - a.pts); },
  view(st, pid) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    const jogando = st.pts[pid] !== undefined;
    const souImp = st.imp.includes(pid);
    const fim = st.fase === "fim" || st.fase === "encerrado";
    return {
      fase: st.fase, rodada: st.rodada, jogando, souImp,
      palavra: jogando && !souImp ? st.palavra : fim ? st.palavra : null,
      cat: !souImp || st.dicaCat || fim ? st.cat : null,
      comeca: nome(st.comeca),
      jogadores: st.jog.map((p) => ({ id: p.id, nome: p.name, votou: !!st.votos[p.id], votos: fim || st.fase === "chuteImpostor" ? (st.cont || {})[p.id] || 0 : null })),
      meuVoto: st.votos[pid], votaram: Object.keys(st.votos).length,
      eliminado: st.eliminado ? nome(st.eliminado) : null,
      impostores: fim || st.fase === "chuteImpostor" ? st.imp.map(nome) : null,
      venc: st.venc, motivo: st.motivo, chute: st.chute,
      placar: this._placar(st),
    };
  },
};

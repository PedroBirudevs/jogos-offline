// Stop (Adedonha)
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const LETRAS = "ABCDEFGHIJLMNOPRSTUV".split("");
const CATS = ["Nome", "Animal", "Cidade/Estado/País", "Comida", "Cor", "Objeto", "Profissão", "Marca", "Filme/Série", "Time de futebol"];

module.exports = {
  key: "stop",
  nome: "Stop",
  emoji: "✋",
  desc: "Sorteia uma letra, todo mundo escreve uma palavra pra cada tema. Quem terminar grita STOP!",
  min: 2,
  opcoes: [
    { id: "rodadas", nome: "Rodadas", valores: [3, 5, 8], padrao: 5 },
    { id: "tempo", nome: "Tempo máximo (s)", valores: [60, 90, 120], padrao: 90 },
    { id: "temas", nome: "Quantidade de temas", valores: [6, 8, 10], padrao: 8 },
  ],
  init(list, o, ctx) {
    const st = {
      jog: list, rodadas: Number(o.rodadas) || 5, tempo: (Number(o.tempo) || 90) * 1000,
      cats: CATS.slice(0, Number(o.temas) || 8), r: 0, usadas: [], pts: Object.fromEntries(list.map((p) => [p.id, 0])),
    };
    this._nova(st, ctx);
    return st;
  },
  _nova(st, ctx) {
    st.r++;
    const livres = LETRAS.filter((l) => !st.usadas.includes(l));
    st.letra = livres[Math.floor(Math.random() * livres.length)]; st.usadas.push(st.letra);
    st.resp = Object.fromEntries(st.jog.map((p) => [p.id, st.cats.map(() => "")]));
    st.marcas = {}; st.quemParou = null; st.fase = "contagem"; st.fim = ctx.now() + 3000;
    ctx.later(3000, () => {
      st.fase = "escrevendo"; st.fim = ctx.now() + st.tempo;
      st.timer = ctx.later(st.tempo, () => { if (st.fase === "escrevendo") this._parar(st, null, ctx); });
    });
  },
  _parar(st, pid, ctx) {
    ctx.cancel(st.timer);
    st.quemParou = pid; st.fase = "parou"; st.fim = ctx.now() + 3000;
    ctx.later(3000, () => { st.fase = "correcao"; });
  },
  _valida(st, pid, c) {
    const v = norm(st.resp[pid][c]);
    if (!v || v[0] !== st.letra.toLowerCase()) return false;
    const marcas = (st.marcas[pid + ":" + c] || []).length;
    return marcas < Math.max(1, Math.ceil((st.jog.length - 1) / 2));
  },
  _pontos(st, pid, c) {
    if (!this._valida(st, pid, c)) return 0;
    const v = norm(st.resp[pid][c]);
    const iguais = st.jog.filter((p) => p.id !== pid && this._valida(st, p.id, c) && norm(st.resp[p.id][c]) === v).length;
    return iguais ? 5 : 10;
  },
  act(st, pid, a, ctx) {
    if (st.pts[pid] === undefined) return "Você está só assistindo";
    if (a.type === "resp" && (st.fase === "escrevendo" || st.fase === "parou")) {
      const arr = Array.isArray(a.resp) ? a.resp : [];
      st.resp[pid] = st.cats.map((_, i) => String(arr[i] || "").slice(0, 30));
      return;
    }
    if (a.type === "stop" && st.fase === "escrevendo") {
      if (Array.isArray(a.resp)) st.resp[pid] = st.cats.map((_, i) => String(a.resp[i] || "").slice(0, 30));
      if (st.resp[pid].some((x) => !norm(x))) return "Preencha todos os temas pra dar STOP";
      this._parar(st, pid, ctx); return;
    }
    if (a.type === "marcar" && st.fase === "correcao") {
      const k = a.alvo + ":" + a.c; if (a.alvo === pid) return "Não dá pra marcar a sua";
      const m = st.marcas[k] = st.marcas[k] || [];
      const i = m.indexOf(pid); if (i >= 0) m.splice(i, 1); else m.push(pid);
      return;
    }
    if (a.type === "proxima" && st.fase === "correcao") {
      for (const p of st.jog) st.cats.forEach((_, c) => (st.pts[p.id] += this._pontos(st, p.id, c)));
      if (st.r >= st.rodadas) {
        st.fase = "fim";
        ctx.finish({ titulo: "✋ Stop — resultado", linhas: this._placar(st).map((x) => ({ nome: x.nome, pontos: x.pts + " pts" })) });
      } else this._nova(st, ctx);
      return;
    }
  },
  _placar(st) { return st.jog.map((p) => ({ id: p.id, nome: p.name, pts: st.pts[p.id] })).sort((a, b) => b.pts - a.pts); },
  view(st, pid) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    const v = { fase: st.fase, r: st.r, rodadas: st.rodadas, letra: st.fase === "contagem" ? null : st.letra, cats: st.cats, fim: st.fim, jogando: st.pts[pid] !== undefined, quemParou: st.quemParou ? nome(st.quemParou) : null, placar: this._placar(st) };
    if (v.jogando) v.minhas = st.resp[pid];
    if (st.fase === "correcao") {
      v.tabela = st.cats.map((cat, c) => ({
        cat,
        linhas: st.jog.map((p) => ({ id: p.id, nome: p.name, txt: st.resp[p.id][c], pts: this._pontos(st, p.id, c), marcas: (st.marcas[p.id + ":" + c] || []).length, eu: (st.marcas[p.id + ":" + c] || []).includes(pid) })),
      }));
      v.rodadaPts = Object.fromEntries(st.jog.map((p) => [p.id, st.cats.reduce((s, _, c) => s + this._pontos(st, p.id, c), 0)]));
    }
    return v;
  },
};

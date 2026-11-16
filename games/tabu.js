// Tabu: descreva a palavra sem falar as proibidas. Times A x B.
const CARTAS = require("../data/tabu");
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

module.exports = {
  key: "tabu",
  ordem: 5,
  nome: "Tabu",
  emoji: "🤐",
  desc: "Faça seu time adivinhar a palavra sem falar as proibidas. O outro time fiscaliza.",
  min: 4,
  opcoes: [
    { id: "tempo", nome: "Segundos por vez", valores: [45, 60, 90], padrao: 60 },
    { id: "voltas", nome: "Vezes que cada um explica", valores: [1, 2], padrao: 1 },
  ],
  init(list, o) {
    const emb = shuffle(list);
    const A = emb.filter((_, i) => i % 2 === 0).map((p) => p.id), B = emb.filter((_, i) => i % 2 === 1).map((p) => p.id);
    const ordem = [];
    const voltas = Number(o.voltas) || 1;
    for (let v = 0; v < voltas; v++) for (let i = 0; i < Math.max(A.length, B.length); i++) { if (A[i]) ordem.push(A[i]); if (B[i]) ordem.push(B[i]); }
    const st = { jog: list, A, B, ordem, i: 0, tempo: (Number(o.tempo) || 60) * 1000, baralho: shuffle(CARTAS), placar: { A: 0, B: 0 }, fase: "pronto", hist: [] };
    return st;
  },
  _time(st, id) { return st.A.includes(id) ? "A" : st.B.includes(id) ? "B" : null; },
  _carta(st) { if (!st.baralho.length) st.baralho = shuffle(CARTAS); return st.baralho.pop(); },
  act(st, pid, a, ctx) {
    const exp = st.ordem[st.i];
    if (a.type === "comecar" && st.fase === "pronto" && pid === exp) {
      st.fase = "jogando"; st.carta = this._carta(st); st.vez = []; st.fim = ctx.now() + st.tempo;
      st.timer = ctx.later(st.tempo, () => this._acabou(st));
      return;
    }
    if (st.fase === "jogando") {
      const t = this._time(st, pid), tExp = this._time(st, exp);
      if (a.type === "acertou" && pid === exp) { st.vez.push({ p: st.carta[0], r: "✅" }); st.placar[tExp]++; st.carta = this._carta(st); return; }
      if (a.type === "pular" && pid === exp) { st.vez.push({ p: st.carta[0], r: "⏭" }); st.carta = this._carta(st); return; }
      if (a.type === "proibida" && (pid === exp || (t && t !== tExp))) { st.vez.push({ p: st.carta[0], r: "🚫" }); st.placar[tExp]--; st.carta = this._carta(st); return; }
    }
    if (a.type === "proxima" && st.fase === "resumo") {
      st.i++;
      st.vez = [];
      if (st.i >= st.ordem.length) {
        st.fase = "fim";
        const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
        const venc = st.placar.A === st.placar.B ? "Empate!" : st.placar.A > st.placar.B ? "Time A venceu" : "Time B venceu";
        ctx.finish({ titulo: `🤐 Tabu — ${venc}`, linhas: [{ nome: "Time A (" + st.A.map(nome).join(", ") + ")", pontos: st.placar.A + " pts" }, { nome: "Time B (" + st.B.map(nome).join(", ") + ")", pontos: st.placar.B + " pts" }] });
      } else st.fase = "pronto";
      return;
    }
  },
  _acabou(st) { if (st.fase !== "jogando") return; st.fase = "resumo"; st.hist.push({ exp: st.ordem[st.i], vez: st.vez }); },
  view(st, pid) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    const exp = st.ordem[st.i], tExp = this._time(st, exp), meu = this._time(st, pid);
    const souExp = pid === exp, fiscal = meu && meu !== tExp;
    return {
      fase: st.fase, vez: st.i + 1, total: st.ordem.length,
      exp, expNome: nome(exp), timeExp: tExp, meuTime: meu, souExp, fiscal,
      A: st.A.map(nome), B: st.B.map(nome), placar: st.placar,
      carta: st.fase === "jogando" && (souExp || fiscal) ? st.carta : null,
      fim: st.fim, lista: st.vez || [],
    };
  },
};

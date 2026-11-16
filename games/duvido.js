// Duvido: "eu falo 8 times..." — o próximo aumenta ou duvida, e quem foi duvidado tem que provar.
const CATS = require("../data/duvido");
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

module.exports = {
  key: "duvido",
  ordem: 6,
  nome: "Duvido",
  emoji: "🤨",
  desc: "Diga quantos itens de um tema você consegue falar. O próximo aumenta ou grita DUVIDO!",
  min: 2,
  opcoes: [
    { id: "rodadas", nome: "Rodadas", valores: [5, 8, 12], padrao: 8 },
    { id: "seg", nome: "Segundos por item na prova", valores: [3, 4, 6], padrao: 4 },
  ],
  init(list, o) {
    const st = { jog: list, rodadas: Number(o.rodadas) || 8, seg: Number(o.seg) || 4, r: 0, cats: shuffle(CATS), pts: Object.fromEntries(list.map((p) => [p.id, 0])), vez: Math.floor(Math.random() * list.length) };
    this._nova(st);
    return st;
  },
  _nova(st) {
    st.r++;
    st.cat = st.cats[(st.r - 1) % st.cats.length];
    st.lance = 0; st.dono = null; st.duvidou = null; st.cont = 0; st.votos = {}; st.fase = "lances"; st.res = null;
  },
  _atual(st) { return st.jog[st.vez % st.jog.length].id; },
  act(st, pid, a, ctx) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    if (st.fase === "lances") {
      if (pid !== this._atual(st)) return "Não é sua vez";
      if (a.type === "lance") {
        const n = Math.round(Number(a.n));
        if (!(n > st.lance)) return `Tem que ser mais que ${st.lance}`;
        if (n > 99) return "Calma lá 😅";
        st.lance = n; st.dono = pid; st.vez++; return;
      }
      if (a.type === "duvido") {
        if (!st.dono) return "Ainda não tem lance pra duvidar";
        st.duvidou = pid; st.fase = "prova"; st.cont = 0;
        st.dur = Math.max(15, st.lance * st.seg) * 1000; st.fim = ctx.now() + st.dur;
        st.timer = ctx.later(st.fim - ctx.now(), () => { if (st.fase === "prova") this._fimProva(st); });
        return;
      }
    }
    if (st.fase === "prova" && pid === st.dono) {
      if (a.type === "mais") { st.cont = Math.min(st.lance, st.cont + 1); if (st.cont >= st.lance) { ctx.cancel(st.timer); this._fimProva(st); } return; }
      if (a.type === "menos") { st.cont = Math.max(0, st.cont - 1); return; }
      if (a.type === "desisto") { ctx.cancel(st.timer); this._fimProva(st); return; }
    }
    if (st.fase === "julgamento" && a.type === "voto" && pid !== st.dono && st.pts[pid] !== undefined) {
      st.votos[pid] = !!a.valeu;
      const juizes = st.jog.filter((p) => p.id !== st.dono);
      if (Object.keys(st.votos).length >= juizes.length) this._resolver(st);
      return;
    }
    if (a.type === "proxima" && st.fase === "resultado") {
      if (st.r >= st.rodadas) {
        st.fase = "fim";
        ctx.finish({ titulo: "🤨 Duvido — resultado", linhas: this._placar(st).map((x) => ({ nome: x.nome, pontos: x.pts + " pts" })) });
      } else this._nova(st);
      return;
    }
  },
  _fimProva(st) {
    if (st.cont >= st.lance) { st.fase = "julgamento"; st.votos = {}; }
    else this._resolver(st, false);
  },
  _resolver(st, forca) {
    let ok = forca;
    if (ok === undefined) { const v = Object.values(st.votos); ok = v.filter(Boolean).length >= v.filter((x) => !x).length; }
    const venc = ok ? st.dono : st.duvidou;
    st.pts[venc] += 2;
    st.res = { ok, venc };
    st.fase = "resultado";
    st.vez = st.jog.findIndex((p) => p.id === (ok ? st.duvidou : st.dono)); // quem perdeu começa a próxima
  },
  _placar(st) { return st.jog.map((p) => ({ id: p.id, nome: p.name, pts: st.pts[p.id] })).sort((a, b) => b.pts - a.pts); },
  view(st, pid) {
    const nome = (id) => (st.jog.find((p) => p.id === id) || {}).name;
    return {
      fase: st.fase, r: st.r, rodadas: st.rodadas, cat: st.cat, lance: st.lance,
      dono: st.dono, donoNome: nome(st.dono), duvidouNome: nome(st.duvidou),
      vez: this._atual(st), vezNome: nome(this._atual(st)), minhaVez: pid === this._atual(st),
      souDono: pid === st.dono, cont: st.cont, fim: st.fim, dur: st.dur,
      votei: st.votos[pid] !== undefined, votaram: Object.keys(st.votos).length, juizes: st.jog.length - 1,
      res: st.res ? { ok: st.res.ok, vencNome: nome(st.res.venc) } : null,
      placar: this._placar(st), jogando: st.pts[pid] !== undefined,
    };
  },
};

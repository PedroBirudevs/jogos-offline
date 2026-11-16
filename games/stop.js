// Stop (Adedonha)
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const LETRAS = "ABCDEFGHIJLMNOPRSTUV".split("");
const CATS = ["Nome", "Animal", "Cidade/Estado/País", "Comida", "Cor", "Objeto", "Profissão", "Marca", "Filme/Série", "Time de futebol",
  "Fruta", "Parte do corpo", "Jogador de futebol", "Cantor(a)", "Música", "Personagem", "Coisa que tem na cozinha", "Bebida", "Esporte", "Carro",
  "App ou site", "Jogo de videogame", "Doce", "Coisa de praia", "Instrumento musical", "Coisa que voa", "Desenho animado", "Xingamento leve", "Peça de roupa", "Coisa de viagem",
  "Novela", "Youtuber/Streamer", "Verbo", "Coisa da escola", "Remédio", "Coisa redonda", "Lugar da cidade", "Comida típica", "Inseto", "Planta/Flor"];
const FIXOS = ["Nome", "Animal", "Cidade/Estado/País", "Comida"];

// ===== juiz automático (offline): dicionário + tolerância a plural e erro de digitação =====
const DIC = {};
try {
  const raw = require("../data/dicionario.json");
  const junta = { Comida: ["Comida", "Fruta", "Doce"], "Comida típica": ["Comida"], Animal: ["Animal", "Inseto"], "Coisa que voa": [] };
  for (const k of Object.keys(raw)) DIC[k] = raw[k];
  for (const [k, fontes] of Object.entries(junta)) if (fontes.length) DIC[k] = [...new Set(fontes.flatMap((f) => raw[f] || []))];
} catch (e) { console.log("dicionario.json não encontrado — juiz automático desligado"); }
const IDX = {}; // cat -> { set, porLetra }
for (const [cat, arr] of Object.entries(DIC)) {
  const porLetra = {};
  for (const w of arr) (porLetra[w[0]] = porLetra[w[0]] || []).push(w);
  IDX[cat] = { set: new Set(arr), porLetra };
}
const VERBO = (w) => /^[a-z]{2,}(ar|er|ir|or|por)$/.test(w) && !w.includes(" ");
const CHECAVEIS = [...Object.keys(IDX).filter((c) => CATS.includes(c)), "Verbo"];
const nz = (s) => norm(s).replace(/\s+/g, " ");
function singulares(w) {
  const r = [w];
  if (w.endsWith("oes") || w.endsWith("aes")) r.push(w.slice(0, -3) + "ao");
  if (w.endsWith("ns")) r.push(w.slice(0, -2) + "m");
  if (w.endsWith("is")) r.push(w.slice(0, -2) + "l");
  if (w.endsWith("es")) r.push(w.slice(0, -2));
  if (w.endsWith("s")) r.push(w.slice(0, -1));
  if (w.endsWith("inho") || w.endsWith("inha")) r.push(w.slice(0, -4) + w.slice(-1));
  return r;
}
function lev1(a, b) { // distância de edição <= 1
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, dif = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return dif + (la - i) + (lb - j) <= 1;
}
function confere(cat, txt) {
  const w = nz(txt);
  if (!w) return false;
  if (cat === "Verbo") return VERBO(w);
  const ix = IDX[cat]; if (!ix) return null; // sem dicionário
  const cands = singulares(w);
  if (cands.some((c) => ix.set.has(c))) return true;
  // sem artigo/complemento: "o gato", "suco de laranja" -> "suco"
  const semArt = w.replace(/^(o|a|os|as|um|uma) /, "");
  if (semArt !== w && singulares(semArt).some((c) => ix.set.has(c))) return true;
  const cabeca = semArt.split(" ")[0];
  if (cabeca.length >= 4 && semArt.includes(" ") && ix.set.has(cabeca)) return true;
  if (w.length >= 5) for (const d of ix.porLetra[w[0]] || []) if (d.length >= 4 && cands.some((c) => lev1(c, d))) return true;
  return false;
}

module.exports = {
  key: "stop",
  ordem: 4,
  nome: "Stop",
  emoji: "✋",
  desc: "Sorteia uma letra, todo mundo escreve uma palavra pra cada tema. Quem terminar grita STOP!",
  min: 2,
  opcoes: [
    { id: "rodadas", nome: "Rodadas", valores: [3, 5, 8], padrao: 5 },
    { id: "tempo", nome: "Tempo máximo (s)", valores: [60, 90, 120], padrao: 90 },
    { id: "temas", nome: "Quantidade de temas (sorteados)", valores: [6, 8, 10], padrao: 8 },
    { id: "correcao", nome: "Quem corrige?", valores: ["Juiz automático", "Votação"], padrao: "Juiz automático" },
  ],
  init(list, o, ctx) {
    const juiz = o.correcao !== "Votação" && Object.keys(IDX).length > 0;
    // no juiz automático só entram temas que ele sabe conferir
    const pool = (juiz ? CHECAVEIS : CATS).filter((c) => !FIXOS.includes(c)).sort(() => Math.random() - 0.5);
    const st = {
      jog: list, rodadas: Number(o.rodadas) || 5, tempo: (Number(o.tempo) || 90) * 1000, juiz,
      cats: [...FIXOS, ...pool].slice(0, Number(o.temas) || 8), r: 0, usadas: [], pts: Object.fromEntries(list.map((p) => [p.id, 0])),
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
    ctx.later(3000, () => {
      // veredito do juiz pra cada resposta (true/false); na votação fica tudo valendo até a galera tirar
      st.auto = {};
      for (const p of st.jog) st.cats.forEach((cat, c) => {
        const v = norm(st.resp[p.id][c]);
        const letraOk = !!v && v[0] === st.letra.toLowerCase();
        st.auto[p.id + ":" + c] = !letraOk ? false : st.juiz ? confere(cat, st.resp[p.id][c]) !== false : true;
      });
      if (st.juiz) { st.fase = "correcao"; return; }
      st.fase = "votacao"; this._tema(st, 0, ctx);
    });
  },
  _tema(st, ci, ctx) {
    ctx.cancel(st.timerTema);
    if (ci >= st.cats.length) { st.fase = "correcao"; return; }
    st.ci = ci; st.prontos = []; st.fim = ctx.now() + 10000;
    st.timerTema = ctx.later(10000, () => { if (st.fase === "votacao" && st.ci === ci) this._tema(st, ci + 1, ctx); });
  },
  _maioria(st) { return Math.max(1, Math.ceil((st.jog.length - 1) / 2)); },
  _valida(st, pid, c) {
    const v = norm(st.resp[pid][c]);
    if (!v || v[0] !== st.letra.toLowerCase()) return false;
    const auto = st.auto ? st.auto[pid + ":" + c] : true;
    const contestou = (st.marcas[pid + ":" + c] || []).length >= this._maioria(st);
    // marcar inverte: na votação tira a resposta; no juiz, a galera pode salvar uma que ele recusou (ou tirar uma que ele aceitou)
    return contestou ? !auto : auto;
  },
  _pontos(st, pid, c) {
    if (!this._valida(st, pid, c)) return 0;
    const v = norm(st.resp[pid][c]);
    const iguais = st.jog.filter((p) => p.id !== pid && this._valida(st, p.id, c) && norm(st.resp[p.id][c]) === v).length;
    return iguais ? 5 : 10;
  },
  _confere: confere,
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
    if (a.type === "pronto" && st.fase === "votacao") {
      if (!st.prontos.includes(pid)) st.prontos.push(pid);
      if (st.prontos.length >= st.jog.length) this._tema(st, st.ci + 1, ctx);
      return;
    }
    if (a.type === "marcar" && (st.fase === "correcao" || (st.fase === "votacao" && a.c === st.ci))) {
      const k = a.alvo + ":" + a.c; if (a.alvo === pid) return "Não dá pra marcar a sua";
      if (!norm(st.resp[a.alvo][a.c])) return;
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
    const v = { juiz: st.juiz, maioria: this._maioria(st), fase: st.fase, r: st.r, rodadas: st.rodadas, letra: st.fase === "contagem" ? null : st.letra, cats: st.cats, fim: st.fim, jogando: st.pts[pid] !== undefined, quemParou: st.quemParou ? nome(st.quemParou) : null, placar: this._placar(st) };
    if (v.jogando) v.minhas = st.resp[pid];
    const linha = (p, c) => {
      const k = p.id + ":" + c, v0 = norm(st.resp[p.id][c]);
      return { id: p.id, nome: p.name, txt: st.resp[p.id][c], pts: this._pontos(st, p.id, c), marcas: (st.marcas[k] || []).length, eu: (st.marcas[k] || []).includes(pid),
        motivo: !v0 ? "" : v0[0] !== st.letra.toLowerCase() ? "letra errada" : st.auto && st.auto[k] === false ? "não existe / não é do tema" : "" };
    };
    if (st.fase === "votacao") {
      v.ci = st.ci; v.fim = st.fim; v.prontos = st.prontos.length; v.souPronto = st.prontos.includes(pid);
      v.tema = { cat: st.cats[st.ci], linhas: st.jog.map((p) => linha(p, st.ci)) };
    }
    if (st.fase === "correcao") {
      v.tabela = st.cats.map((cat, c) => ({ cat, linhas: st.jog.map((p) => linha(p, c)) }));
      v.rodadaPts = Object.fromEntries(st.jog.map((p) => [p.id, st.cats.reduce((s, _, c) => s + this._pontos(st, p.id, c), 0)]));
    }
    return v;
  },
};

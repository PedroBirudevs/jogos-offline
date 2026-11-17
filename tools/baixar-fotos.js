// Baixa a foto de cada jogador do Leilão (Wikipédia) pra public/fotos/, pra funcionar offline na viagem.
// Rode COM internet:  node tools/baixar-fotos.js      (pode rodar de novo: só baixa as que faltam)
// Pra tentar de novo as que não acharam:  node tools/baixar-fotos.js --tudo
const https = require("https"), fs = require("fs"), path = require("path");
const DB = require("../data/jogadores.json");
const DIR = path.join(__dirname, "..", "public", "fotos");
const FALHOU = path.join(DIR, "_sem-foto.json");
fs.mkdirSync(DIR, { recursive: true });
const UA = "jogos-offline/1.0 (https://github.com/PedroBirudevs/jogos-offline)";
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const N = (s) => slug(s).split("-").filter((x) => x.length >= 3);
const col = (c) => DB.cols.indexOf(c);
const jog = DB.rows.map((r) => ({ nome: r[col("nome")], clube: r[col("clube")], liga: r[col("liga")] }));
const CLUBE_CURTO = (c) => c.replace(/^(FC|SC|SL|AS|SSC|SS|AC|OL|LOSC|CF|RC)\s+/i, "").replace(/\s+(FC|CF|SC|CP)$/i, "");
const sem = new Set(process.argv.includes("--tudo") ? [] : (() => { try { return JSON.parse(fs.readFileSync(FALHOU)); } catch (e) { return []; } })());

function get(url, n = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": UA } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && n < 5) { r.resume(); return res(get(new URL(r.headers.location, url).href, n + 1)); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode)); }
      const b = []; r.on("data", (d) => b.push(d)); r.on("end", () => res(Buffer.concat(b)));
    }).on("error", rej).setTimeout(20000, function () { this.destroy(new Error("timeout")); });
  });
}
const WIKI_LIGA = { LaLiga: "es", "Serie A": "it", Bundesliga: "de", "Ligue 1": "fr", Eredivisie: "nl", "Liga Portugal": "pt", "Premier League": "en", "Arábia Saudita": "en", "Brasileirão": "pt" };
const casaNome = (nome, titulo) => { const t = N(titulo); return N(nome).every((x) => t.some((y) => y === x || (x.length >= 4 && y.startsWith(x.slice(0, 4))))); };
async function busca(wiki, termo, j) {
  const u = `https://${wiki}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(termo)}&gsrlimit=3&prop=pageimages|extracts&exintro=1&explaintext=1&exchars=900&piprop=thumbnail&pithumbsize=260&format=json`;
  const r = JSON.parse((await get(u)).toString());
  const pags = Object.values((r.query && r.query.pages) || {}).sort((a, b) => a.index - b.index);
  const nomeCurto = N(j.nome).length <= 1; // "Pedro", "Rossi": precisa citar o clube no resumo
  const clubeTok = N(CLUBE_CURTO(j.clube)).filter((x) => x.length >= 4 && !["club", "clube", "real", "sporting", "atletico", "olympique"].includes(x));
  for (const p of pags) {
    const src = p.thumbnail && p.thumbnail.source;
    if (!src || !/\.jpe?g/i.test(src) || !casaNome(j.nome, p.title)) continue;
    if (nomeCurto && clubeTok.length && !clubeTok.some((x) => slug(p.extract || "").includes(x))) continue;
    return src;
  }
  return null;
}
async function foto(j) {
  const c = CLUBE_CURTO(j.clube), w = WIKI_LIGA[j.liga] || "en";
  const tentativas = [["pt", `${j.nome} futebolista ${c}`], ["en", `${j.nome} footballer ${c}`], [w, `${j.nome} ${c}`], ["pt", `${j.nome} futebolista`], ["en", `${j.nome} footballer`]];
  const vistas = new Set();
  for (const [w, t] of tentativas) { if (vistas.has(w + t)) continue; vistas.add(w + t); const s = await busca(w, t, j).catch(() => null); if (s) return s; }
  return null;
}

(async () => {
  const falta = jog.filter((j) => { const f = slug(j.nome + "-" + j.clube); return !fs.existsSync(path.join(DIR, f + ".jpg")) && !sem.has(f); });
  console.log(`${jog.length} jogadores, ${jog.length - falta.length} já ok/pulados, baixando ${falta.length}...`);
  let ok = 0, nao = 0, i = 0;
  const naoAchou = [...sem];
  async function trab() {
    while (i < falta.length) {
      const j = falta[i++], f = slug(j.nome + "-" + j.clube);
      try {
        const src = await foto(j);
        if (!src) throw new Error("sem foto");
        fs.writeFileSync(path.join(DIR, f + ".jpg"), await get(src));
        ok++;
      } catch (e) { nao++; naoAchou.push(f); }
      if ((ok + nao) % 25 === 0) console.log(`  ${ok + nao}/${falta.length}  (fotos: ${ok}, sem: ${nao})`);
    }
  }
  await Promise.all([trab(), trab(), trab(), trab()]);
  fs.writeFileSync(FALHOU, JSON.stringify([...new Set(naoAchou)]));
  console.log(`Pronto! ${ok} fotos novas, ${nao} sem foto (ficam com as iniciais). Agora é só rodar: jogo`);
})();

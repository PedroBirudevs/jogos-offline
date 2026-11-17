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
const jog = DB.rows.map((r) => ({ nome: r[col("nome")], clube: r[col("clube")], liga: r[col("liga")], grupo: r[col("grupo")] }));
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
// ---- busca (mesmo código testado no navegador) ----
const APELIDO = { "Man Utd": "manchester-united", Spurs: "tottenham", "M'gladbach": "gladbach", "Paris SG": "paris", OL: "lyon", "Atlético-MG": "mineiro", "FC Bayern München": "bayern", "Olympique de Marseille": "marseille", "Athletic Club": "athletic", "Sporting CP": "sporting", Inter: "inter", "Real Madrid": "real-madrid", "Atlético de Madrid": "atletico", "FC Barcelona": "barcelona", "Hamburger SV": "hamburg", "FC Schalke 04": "schalke", "LOSC Lille": "lille", "Al Ahli": "ahli", "Al Hilal": "hilal", "Al Nassr": "nassr", "Al Ittihad": "ittihad", "São Paulo": "sao-paulo", "Manchester City": "manchester-city" };
const chaveClube = (c) => APELIDO[c] || slug(CLUBE_CURTO(c));
const api = async (host, q) => JSON.parse((await get(`https://${host}/w/api.php?format=json&${q}`)).toString());
const ehCurto = (nome) => N(nome).length <= 1; // "Pedro", "Rossi", "Hulk": regra mais rígida
const nomesDe = (e) => [...Object.values(e.labels || {}).map((x) => x.value), ...Object.values(e.aliases || {}).flat().map((x) => x.value)].map(slug);
const ROTULOS = {};
async function rotulos(ids) {
  const falta = ids.filter((i) => !(i in ROTULOS));
  for (let k = 0; k < falta.length; k += 50) {
    const r = await api("www.wikidata.org", "action=wbgetentities&props=labels|aliases&languages=pt|en&ids=" + falta.slice(k, k + 50).join("|"));
    for (const [id, e] of Object.entries(r.entities || {})) ROTULOS[id] = nomesDe(e).join(" ");
  }
  return ids.map((i) => ROTULOS[i] || "");
}
// 1) Wikidata: jogador de futebol com esse nome que JOGOU NESSE CLUBE e tem foto
async function wikidata(j) {
  const s = await api("www.wikidata.org", "action=query&list=search&srlimit=15&srsearch=" + encodeURIComponent(j.nome + " haswbstatement:P106=Q937857"));
  const ids = ((s.query && s.query.search) || []).map((x) => x.title);
  if (!ids.length) return null;
  const ents = (await api("www.wikidata.org", "action=wbgetentities&props=claims|labels|aliases&languages=pt|en|es&ids=" + ids.join("|"))).entities || {};
  const n = slug(j.nome), chave = chaveClube(j.clube);
  for (const id of ids) {
    const e = ents[id]; if (!e) continue;
    const c = e.claims || {};
    if (!c.P18) continue;
    if (ehCurto(j.nome) && !nomesDe(e).includes(n)) continue;
    const posicoes = (c.P413 || []).map((x) => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value.id);
    if (posicoes.length && (j.grupo === "GOL") !== posicoes.includes("Q201330")) continue;
    const times = (c.P54 || []).map((x) => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value.id).filter(Boolean);
    if ((await rotulos(times)).some((l) => l.includes(chave))) {
      const arq = c.P18[0].mainsnak.datavalue.value;
      return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(arq.replace(/ /g, "_")) + "?width=260";
    }
  }
  return null;
}
// 2) Wikipédia: a página tem que citar o clube; nome curto: o clube na 1ª frase ou "conhecido como Fulano"
const casaNome = (nome, titulo) => { const t = N(titulo); return N(nome).every((x) => t.some((y) => y === x || (x.length >= 4 && y.startsWith(x.slice(0, 4))))); };
function curtoOk(nome, p, chave) {
  const n = slug(nome), e = slug(p.extract || ""), t = slug(p.title.replace(/\s*\(.*\)/, ""));
  // o clube tem que estar na parte "é um futebolista que atua no X" (não no lugar onde nasceu)
  const f1 = (p.extract || "").split(/\.\s/)[0], m = f1.match(/\s(é|is|es|est|ist|è)\s/);
  const frase1 = m ? slug(f1.slice(m.index)) : "";
  return t === n || frase1.includes(chave) || ["como-" + n, "simplesmente-" + n, "simply-" + n, "known-as-" + n].some((x) => (e + "-").includes(x + "-"));
}
// goleiro tem que ser goleiro (e quem é de linha não pode ser goleiro): evita pegar o colega de time com o mesmo nome
const GOLEIRO = /(goleiro|guarda-redes|goalkeeper|portero|portiere|torwart|gardien|keeper|doelman)/i;
const posOk = (j, txt) => { const ini = String(txt || "").split(/\.\s/).slice(0, 2).join(". "); return j.grupo === "GOL" ? GOLEIRO.test(ini) : !GOLEIRO.test(ini.split(/\.\s/)[0]); };
async function wikipedia(wiki, termo, j) {
  const r = await api(wiki + ".wikipedia.org", `action=query&generator=search&gsrsearch=${encodeURIComponent(termo)}&gsrlimit=4&prop=pageimages|extracts&exintro=1&explaintext=1&exchars=1200&piprop=thumbnail&pithumbsize=260`);
  const pags = Object.values((r.query && r.query.pages) || {}).sort((a, b) => a.index - b.index);
  const chave = chaveClube(j.clube);
  for (const p of pags) {
    const src = p.thumbnail && p.thumbnail.source;
    if (!src || !/\.jpe?g/i.test(src) || !casaNome(j.nome, p.title)) continue;
    if (!slug(p.extract || "").includes(chave)) continue;
    if (ehCurto(j.nome) && !curtoOk(j.nome, p, chave)) continue;
    if (!posOk(j, p.extract)) continue;
    return src;
  }
  return null;
}
async function foto(j) {
  const w = await wikidata(j).catch(() => null);
  if (w) return w;
  const c = CLUBE_CURTO(j.clube);
  for (const [wk, t] of [["pt", `${j.nome} futebolista ${c}`], ["en", `${j.nome} footballer ${c}`]]) {
    const s = await wikipedia(wk, t, j).catch(() => null);
    if (s) return s;
  }
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

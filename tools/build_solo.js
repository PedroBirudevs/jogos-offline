// Gera os arquivos do MODO SOLO (Leilão contra bots, rodando 100% no navegador, sem servidor):
//   public/solo/leilao.bundle.js  → games/leilao.js embrulhado pra rodar no navegador
//   public/solo/jogadores.json    → cópia dos dados
// O servidor roda isto sozinho toda vez que liga (então sempre fica igual à versão do jogo com amigos).
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
function buildSolo() {
  const src = fs.readFileSync(path.join(RAIZ, "games", "leilao.js"), "utf8");
  const bundle = `/* gerado por tools/build_solo.js — não editar */
(function () {
  var module = { exports: {} }, exports = module.exports, __dirname = "games";
  var process = { env: window.__ENV || {} }; // (só o teste automático mexe nisso)
  var require = function (p) {
    if (/jogadores\\.json$/.test(p)) return window.__DB;
    if (p === "fs") return { readdirSync: function () { return window.__FOTOS || []; } };
    if (p === "path") return { join: function () { return [].slice.call(arguments).join("/"); } };
    throw new Error("módulo não disponível no modo solo: " + p);
  };
${src}
  window.LEILAO = module.exports;
})();
`;
  const dir = path.join(RAIZ, "public", "solo");
  fs.mkdirSync(dir, { recursive: true });
  const escreve = (f, c) => { const p = path.join(dir, f); try { if (fs.readFileSync(p, "utf8") === c) return; } catch (e) {} fs.writeFileSync(p, c); };
  escreve("leilao.bundle.js", bundle);
  escreve("jogadores.json", fs.readFileSync(path.join(RAIZ, "data", "jogadores.json"), "utf8"));
}
module.exports = buildSolo;
if (require.main === module) { buildSolo(); console.log("modo solo gerado em public/solo/"); }

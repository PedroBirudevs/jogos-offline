"""Gera data/dicionario.json pro juiz automático do Stop.
Fontes: IBGE (municípios e estados — kelvins/municipios-brasileiros; nomes dos censos — datasets-br/prenomes),
data/jogadores.json (jogadores e clubes) e as listas escritas à mão em tools/listas_stop.py.
Uso: python3 tools/build_dicionario.py <municipios.csv> <estados.csv> <nomes-censos-ibge.csv>"""
import csv, json, os, sys, unicodedata, re

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from listas_stop import L

def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()

def lista(txt):
    return {norm(x) for x in txt.replace("\n", ",").split(",") if norm(x)}

mun_csv, est_csv, nomes_csv = sys.argv[1:4]
D = {k: lista(v) for k, v in L.items()}

lugares = set()
for r in csv.DictReader(open(mun_csv, encoding="utf-8-sig")):
    lugares.add(norm(r["nome"]))
for r in csv.DictReader(open(est_csv, encoding="utf-8-sig")):
    lugares.add(norm(r["nome"]))
estados = set()
for r in csv.DictReader(open(est_csv, encoding="utf-8-sig")):
    estados.add(norm(r["nome"])); estados.add(norm(r["uf"]))
D["Estado do Brasil"] = estados
for r in csv.DictReader(open(mun_csv, encoding="utf-8-sig")):
    if str(r.get("capital", "0")) == "1": D["Capital"].add(norm(r["nome"]))
lugares |= D["País"] | D.pop("Cidade mundial")
D["Cidade/Estado/País"] = lugares

nomes = set()
for r in csv.DictReader(open(nomes_csv, encoding="utf-8-sig")):
    tot = sum(int(r[c] or 0) for c in r if c != "Nome")
    if tot >= 400:
        nomes.add(norm(r["Nome"]))
D["Nome"] = nomes
# nome masculino / feminino: lista de gênero do Wikidata ∩ nomes comuns do Censo (pra ficar nome brasileiro de verdade)
base = os.path.dirname(nomes_csv)
for arq, cat in (("wd_masculinos-pt.csv", "Nome masculino"), ("wd_femininos.csv", "Nome feminino")):
    try:
        D[cat] = {norm(r["itemLabel"]) for r in csv.DictReader(open(os.path.join(base, arq), encoding="utf-8-sig"))} & nomes
    except FileNotFoundError:
        pass

j = json.load(open(os.path.join(RAIZ, "data", "jogadores.json")))
cols = j["cols"]; iN, iC = cols.index("nome"), cols.index("clube")
for row in j["rows"]:
    n = norm(row[iN]); D["Jogador de futebol"].add(n)
    partes = n.split()
    if len(partes) > 1 and len(partes[-1]) >= 4:
        D["Jogador de futebol"].add(partes[-1])
    D["Time de futebol"].add(norm(row[iC]))

D["Coisa que tem na cozinha"] |= D["Objeto"] & {"faca", "garfo", "colher", "panela", "prato", "copo", "xicara", "geladeira", "fogao"}
out = {k: sorted(v) for k, v in sorted(D.items())}
json.dump(out, open(os.path.join(RAIZ, "data", "dicionario.json"), "w"), ensure_ascii=False, separators=(",", ":"))
for k, v in out.items():
    print(f"{k:28} {len(v)}")
print("tamanho:", os.path.getsize(os.path.join(RAIZ, "data", "dicionario.json")) // 1024, "KB")

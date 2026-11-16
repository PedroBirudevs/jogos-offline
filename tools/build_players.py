"""Gera data/jogadores.json a partir do CSV do EA FC 27 + elencos aproximados do Brasileirão.
Uso: python3 tools/build_players.py caminho/players-db.csv
"""
import csv, json, sys, random, collections, os
sys.path.insert(0, os.path.dirname(__file__))
from brasileirao_manual import CLUBES

GRANDES = {"Premier League": "Premier League", "LALIGA EA SPORTS": "LaLiga", "Serie A Enilive": "Serie A",
           "Bundesliga": "Bundesliga", "Ligue 1 McDonald's": "Ligue 1", "Liga Portugal": "Liga Portugal",
           "ROSHN Saudi League": "Arábia Saudita", "Eredivisie": "Eredivisie"}
# só quem joga: por clube, os melhores de cada posição (titulares + reservas que entram)
POR_CLUBE = {"GOL": 1, "DEF": 5, "MEI": 5, "ATA": 3}
BR_EA = {"Botafogo", "Bahia"}
GRUPO = {"GK": "GOL", "CB": "DEF", "LB": "DEF", "RB": "DEF", "LWB": "DEF", "RWB": "DEF",
         "CDM": "MEI", "CM": "MEI", "CAM": "MEI", "LM": "MEI", "RM": "MEI",
         "ST": "ATA", "CF": "ATA", "LW": "ATA", "RW": "ATA"}
PT = {"GK": "GOL", "CB": "ZAG", "LB": "LE", "RB": "LD", "LWB": "ALE", "RWB": "ALD", "CDM": "VOL", "CM": "MC",
      "CAM": "MEI", "LM": "ME", "RM": "MD", "ST": "ATA", "CF": "SA", "LW": "PE", "RW": "PD"}
NAC = {"Brazil":"BR","Argentina":"AR","Uruguay":"UY","Colombia":"CO","Chile":"CL","Paraguay":"PY","Ecuador":"EC","Peru":"PE","Venezuela":"VE","Bolivia":"BO",
 "Mexico":"MX","United States":"US","Canada":"CA","France":"FR","Spain":"ES","Portugal":"PT","Italy":"IT","Germany":"DE","Netherlands":"NL","Belgium":"BE",
 "England":"GB","Scotland":"GB","Wales":"GB","Northern Ireland":"GB","Republic of Ireland":"IE","Croatia":"HR","Serbia":"RS","Switzerland":"CH","Austria":"AT","Denmark":"DK",
 "Norway":"NO","Sweden":"SE","Finland":"FI","Poland":"PL","Czech Republic":"CZ","Czechia":"CZ","Slovakia":"SK","Slovenia":"SI","Hungary":"HU","Romania":"RO","Ukraine":"UA",
 "Greece":"GR","Türkiye":"TR","Turkey":"TR","Georgia":"GE","Albania":"AL","Kosovo":"XK","Bosnia and Herzegovina":"BA","Montenegro":"ME","North Macedonia":"MK","Bulgaria":"BG",
 "Russia":"RU","Iceland":"IS","Morocco":"MA","Algeria":"DZ","Tunisia":"TN","Egypt":"EG","Senegal":"SN","Nigeria":"NG","Ghana":"GH","Côte d'Ivoire":"CI","Ivory Coast":"CI",
 "Cameroon":"CM","Mali":"ML","Guinea":"GN","Burkina Faso":"BF","Gabon":"GA","DR Congo":"CD","Congo DR":"CD","Congo":"CG","Angola":"AO","South Africa":"ZA","Zambia":"ZM",
 "Cape Verde":"CV","Cabo Verde":"CV","Gambia":"GM","Guinea-Bissau":"GW","Benin":"BJ","Togo":"TG","Mozambique":"MZ","Zimbabwe":"ZW","Kenya":"KE","Japan":"JP","Korea Republic":"KR",
 "South Korea":"KR","China PR":"CN","Australia":"AU","New Zealand":"NZ","Saudi Arabia":"SA","Iran":"IR","Iraq":"IQ","Qatar":"QA","United Arab Emirates":"AE","Israel":"IL",
 "Jamaica":"JM","Costa Rica":"CR","Panama":"PA","Honduras":"HN","Haiti":"HT","Suriname":"SR","Curaçao":"CW","Armenia":"AM","Luxembourg":"LU","Cyprus":"CY","Estonia":"EE",
 "Latvia":"LV","Lithuania":"LT","Belarus":"BY","Moldova":"MD","Uzbekistan":"UZ","Equatorial Guinea":"GQ","Sierra Leone":"SL","Comoros":"KM","Madagascar":"MG","Libya":"LY",
 "Central African Republic":"CF","Burundi":"BI","Uganda":"UG","Tanzania":"TZ","Mauritania":"MR","Guadeloupe":"GP","Martinique":"MQ","French Guiana":"GF","Dominican Republic":"DO",
 "Trinidad and Tobago":"TT","Philippines":"PH","Indonesia":"ID","Thailand":"TH","India":"IN","Malta":"MT","Faroe Islands":"FO","Liechtenstein":"LI","Andorra":"AD","Grenada":"GD",
 "Montserrat":"MS","Holland":"NL","Cape Verde Islands":"CV","Azerbaijan":"AZ","Hong Kong":"HK","St. Lucia":"LC","St. Kitts and Nevis":"KN","Eritrea":"ER","El Salvador":"SV","Guatemala":"GT","Antigua and Barbuda":"AG","Malawi":"MW","Niger":"NE","Puerto Rico":"PR","Yemen":"YE","Pakistan":"PK","Chad":"TD","Kazakhstan":"KZ","Cuba":"CU","Barbados":"BB","Mauritius":"MU","Somalia":"SO","Oman":"OM","Gibraltar":"GI","Afghanistan":"AF","Bermuda":"BM","Guyana":"GY","Syria":"SY","Lebanon":"LB","Jordan":"JO","Palestine":"PS","Sudan":"SD","Ethiopia":"ET","Rwanda":"RW","Namibia":"NA","Liberia":"LR"}
EST = {"Rossi":"AR","Arrascaeta":"UY","Guillermo Varela":"UY","De la Cruz":"UY","Saúl":"ES","Carrascal":"CO","Gonzalo Plata":"EC","Erick Pulgar":"CL","Gustavo Gómez":"PY",
 "Piquerez":"UY","Giay":"AR","Aníbal Moreno":"AR","Emiliano Martínez":"UY","Facundo Torres":"UY","Flaco López":"AR","Lucas Villalba":"AR","Lucas Romero":"AR","Freytes":"AR",
 "Lucho Acosta":"AR","Kevin Serna":"CO","Canobbio":"UY","Germán Cano":"AR","Arboleda":"EC","Enzo Díaz":"AR","Bobadilla":"PY","Calleri":"AR","Tapia":"PE","Kannemann":"AR",
 "Villasanti":"PY","Cristaldo":"AR","Amuzu":"BE","Braithwaite":"DK","Hurtado":"CO","Isidro Pitta":"PY","Junior Alonso":"PY","Cuello":"AR","Escobar":"AR","Tomás Rincón":"VE",
 "Rollheiser":"AR","Barreal":"AR","Lautaro Díaz":"AR","Félix Torres":"EC","Angileri":"AR","José Martínez":"VE","Rodrigo Garro":"AR","Carrillo":"PE","Memphis Depay":"NL",
 "Puma Rodríguez":"UY","Nuno Moreira":"PT","Andrés Gómez":"CO","Pablo Vegetti":"AR","Raúl Cáceres":"PY","Rochet":"UY","Bernabei":"AR","Aguirre":"AR","Carbonero":"CO",
 "Borré":"CO","Enner Valencia":"EC","Zapelli":"AR","Kevin Viveros":"CO","Sebastián Gómez":"CO","Diego Hernández":"UY","Guzmán":"AR"}
flag = lambda cc: "".join(chr(0x1F1E6 + ord(c) - 65) for c in cc) if cc and len(cc) == 2 and cc != "XK" else "🏳️"

def stats_fake(pos, ovr, rnd):
    base = {"GOL": (ovr + 1, ovr - 1, ovr - 10, ovr + 2, 45, ovr - 1), "DEF": (68, 45, 62, 62, ovr, ovr - 2), "MEI": (70, 66, ovr + 1, ovr, 60, 70), "ATA": (ovr + 4, ovr + 1, 66, ovr + 1, 35, 70)}[pos]
    return [max(25, min(97, int(b + rnd.randint(-5, 5) + (ovr - 72) * 0.5))) for b in base]

def main(csv_path):
    rows = [x for x in csv.DictReader(open(csv_path, encoding="utf-8")) if x["gender"].startswith("Men")]
    clubs = collections.defaultdict(list)
    for x in rows: clubs[(x["club_name"], x["league_name"])].append(int(x["overall"]))
    rank = sorted(((sum(sorted(v, reverse=True)[:16]) / min(16, len(v)), k) for k, v in clubs.items() if len(v) >= 14), reverse=True)
    top100 = {k for _, k in rank[:100]}
    out, seen = [], set()
    for x in rows:
        k = (x["club_name"], x["league_name"])
        liga = GRANDES.get(x["league_name"]) or ("Brasileirão" if x["club_name"] in BR_EA else None)
        if not liga: continue
        p = x["positions"].split(",")[0].strip()
        if p not in GRUPO: continue
        nome = x["common_name"] or x["short_name"]
        key = (nome, x["club_name"])
        if key in seen: continue
        seen.add(key)
        st = [int(float(x[c] or 0)) for c in ("pace", "shooting", "passing", "dribbling", "defending", "physic")]
        out.append([nome, PT[p], GRUPO[p], int(x["overall"]), *st, x["club_name"], liga or "Top 100", flag(NAC.get(x["nationality_name"], "")), 1 if k in top100 or liga == "Brasileirão" else 0, 0])
    rnd = random.Random(27)
    for club, lst in CLUBES.items():
        for nome, p, ovr in lst:
            g = GRUPO[p]
            out.append([nome, PT[p], g, ovr, *stats_fake(g, ovr, rnd), club, "Brasileirão", flag(EST.get(nome, "BR")), 1, 1])
    # corta quem não costuma jogar
    porclube = collections.defaultdict(list)
    for r in out: porclube[(r[10], r[2])].append(r)
    out = []
    for (clube, g), lst in porclube.items():
        lst.sort(key=lambda r: -r[3]); out += lst[:POR_CLUBE[g]]
    out.sort(key=lambda r: -r[3])
    cols = ["nome", "pos", "grupo", "ovr", "pac", "sho", "pas", "dri", "def", "phy", "clube", "liga", "flag", "top", "aprox"]
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "data"), exist_ok=True)
    dst = os.path.join(os.path.dirname(__file__), "..", "data", "jogadores.json")
    json.dump({"cols": cols, "fonte": "EA SPORTS FC 27 (ratings públicos) + Brasileirão aproximado", "rows": out}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "jogadores ->", dst)
    print(collections.Counter(r[11] for r in out))

if __name__ == "__main__":
    main(sys.argv[1])

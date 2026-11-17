# 🎮 Jogos de Viagem

Jogos pra jogar com os amigos **sem internet**: um celular Android vira o "dono da sala",
liga o roteador Wi-Fi e roda os jogos. Os outros entram pelo navegador.

Jogos: ⚽ Leilão OVER (estilo 100pracada: R$ 100 pra cada, lances de 10s, bots, partidas AO VIVO com tática, pontos corridos/mata-mata, gol de ouro, taça de quem gastou melhor — jogadores reais do EA FC 27, separados por liga) · 🎯 Sintonia · 🕵️ Impostor · 🤐 Tabu · ✋ Stop · 🤨 Duvido

## Instalar no Android (uma vez só, COM internet)
1. Instale o **Termux** pela F-Droid (https://f-droid.org/packages/com.termux/). A versão da Play Store é antiga.
2. Abra o Termux e cole:
```
pkg update -y && pkg install -y nodejs-lts git && git clone https://github.com/PedroBirudevs/jogos-offline ~/jogos-offline && echo "alias jogo='cd ~/jogos-offline && node server.js'" >> ~/.bashrc && echo PRONTO
```

## Na viagem (sem internet)
1. No celular do dono: ligue o **Roteador Wi-Fi / Ponto de acesso**.
2. Os amigos conectam nesse Wi-Fi.
3. No Termux do dono, digite `jogo` e Enter.
4. O dono abre `http://localhost:3000` no navegador: na sala aparece um **QR code**. Os amigos (já no Wi-Fi) apontam a câmera e entram.
   O endereço muda quando o roteador é religado (Android sorteia a rede), por isso o QR code.

Dica: puxe a notificação do Termux e toque em **Acquire wakelock** pra ele não parar com a tela apagada.

Se não aparecer o endereço: no celular de um amigo, abra os detalhes do Wi-Fi e veja o **Gateway/Roteador** — esse é o IP. Use `http://ESSE-IP:3000`.

## Atualizar (com internet)
```
cd ~/jogos-offline && git pull
```

## Jogadores do Leilão
- Fonte: ratings públicos do **EA SPORTS FC 27**. Leilões separados: Brasileirão, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, ou todas juntas (+ Liga Portugal, Arábia Saudita e Eredivisie).
- Só os clubes grandes de cada liga (Brasil: os 12 grandes; Inglaterra: o big 6; ~6 por liga na Europa) e, por clube, os principais 2 GOL, 6 DEF, 6 MEI e 4 ATA. 894 jogadores.
- Leilão de uma liga só: a nota é relativa à liga (o melhor de cada liga fica ~91, ex.: Pedro 91 no Brasileirão).
- "Todas juntas": escala única do mundo (aí o Pedro fica 82 e o Luis Díaz 88), pra ser justo.
- Os clubes brasileiros fora do FC 27 têm elencos e overalls **aproximados**, ajustados pela fase de 2026 (aparece "overall aproximado" na carta).
  Pra corrigir, edite `tools/brasileirao_manual.py` e rode `python3 tools/build_players.py caminho/players-db.csv`.

## Fotos dos jogadores
As fotos vêm da Wikipédia e ficam salvas no celular (funciona offline depois). Com internet, rode uma vez:
```
cd ~/jogos-offline && node tools/baixar-fotos.js
```
Demora uns 5–10 min. Quem não tiver foto livre na Wikipédia continua com as iniciais. Rodar de novo só baixa o que falta.

## Stop: quem corrige
- **Juiz automático** (padrão): confere cada resposta num dicionário offline (`data/dicionario.json`: municípios e estados do IBGE, nomes do Censo, países, jogadores e clubes do Leilão e listas de animais, comidas, cores, profissões, marcas…). Aceita sem acento, plural e um erro de digitação. Só sorteia temas que ele sabe conferir. Se ele errar, a galera toca na resposta e muda por maioria.
- **Votação**: 10s por tema pra tirar as respostas erradas; quando todo mundo aperta "Pronto", pula pro próximo.
- Pra aumentar o dicionário, edite `tools/listas_stop.py` e rode `python3 tools/build_dicionario.py municipios.csv estados.csv nomes-censos-ibge.csv`.

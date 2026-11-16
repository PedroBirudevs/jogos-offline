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
- Só entra quem joga: por clube, o goleiro titular e os principais 5 DEF, 5 MEI e 3 ATA (os melhores de cada posição). 2.337 jogadores no total, ~250 por liga.
- Os outros 18 clubes da Série A **não estão no FC 27**: os elencos e overalls deles são **aproximados** (aparece "overall aproximado" na carta).
  Pra corrigir, edite `tools/brasileirao_manual.py` e rode `python3 tools/build_players.py caminho/players-db.csv`.

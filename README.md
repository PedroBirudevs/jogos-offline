# 🎮 Jogos de Viagem

Jogos pra jogar com os amigos **sem internet**: um celular Android vira o "dono da sala",
liga o roteador Wi-Fi e roda os jogos. Os outros entram pelo navegador.

Jogos: ⚽ Leilão OVER (estilo 100pracada: R$ 100 pra cada, lances de 10s, bots, partidas AO VIVO com tática, pontos corridos/mata-mata, gol de ouro, taça de quem gastou melhor — jogadores reais do EA FC 27, separados por liga) · 🎯 Sintonia · 🕵️ Impostor · 🤐 Tabu · ✋ Stop · 🤨 Duvido

## Instalar no Android (uma vez só, COM internet)
1. Instale o **Termux** pela F-Droid (https://f-droid.org/packages/com.termux/). A versão da Play Store é antiga.
2. Abra o Termux e cole:
```
pkg update -y && pkg install -y nodejs-lts git && git clone https://github.com/PedroBirudevs/jogos-offline ~/jogos-offline && echo "alias jogo='cd ~/jogos-offline && termux-wake-lock; node server.js'" >> ~/.bashrc && echo PRONTO
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

## Leilão OVER (resumo)
- Leilão com martelo ("dou-lhe uma… duas… três"), +1/+5/+10/Tudo/outro valor, formação escolhida durante o leilão.
- Jogador pode fazer mais de uma posição (dados do EA FC: Valverde MC/LD/VOL, Vini PE/ATA): entra em qualquer vaga que ele faz.
- Depois do leilão: 3 reservas por time (1 DEF, 1 MEI, 1 ATA, 82–86), escolhidos com lance do dinheiro que sobrou.
- Partida ao vivo animada: campo com os dois times e as fotos, bola andando, relato, gol com foto, gás de cada jogador,
  troca obrigatória abaixo de 20% (ou lesão) se tiver reserva, intervalo pra trocar/mudar tática, faltas, amarelo/vermelho
  (expulsão e lesão valem só pro jogo).

## Fotos dos jogadores
As fotos vêm da Wikipédia e ficam salvas no celular (funciona offline depois). Com internet, rode uma vez:
```
cd ~/jogos-offline && node tools/baixar-fotos.js
```
Demora uns 5–10 min. Quem não tiver foto livre na Wikipédia continua com as iniciais. Rodar de novo só baixa o que falta.

## Se o pessoal cai toda hora (estrada com sinal que vai e volta)
O motivo quase sempre é este: o Wi-Fi do roteador do celular **não tem internet**. Quando aparece sinal de celular,
o Android/iPhone dos amigos passa a usar os **dados móveis** e para de enxergar o jogo; quando o sinal some, volta pro Wi-Fi. Fica nesse vai-e-volta.
- **Todo mundo que vai jogar: desliga os dados móveis** (ou modo avião e liga só o Wi-Fi). Se o celular perguntar "Wi-Fi sem internet", toca em **manter conectado**.
- iPhone: Ajustes > Celular > desligar "Assistência Wi-Fi" (ou desligar dados celulares).
- **Dono da sala:** desliga os dados móveis também (assim o Wi-Fi fica "sem internet" o tempo todo e ninguém fica trocando),
  desliga o "desligar roteador automaticamente" nas configurações do roteador e deixa o celular carregando.
- No Termux use `termux-wake-lock` antes de `node server.js` (o alias `jogo` já faz isso) pra o Android não pausar o servidor com a tela apagada.

O jogo agora se vira com quem cai: reconecta sozinho e mostra "reconectando…". Quem sair e abrir o jogo de novo **no mesmo celular**
volta sozinho pro mesmo lugar (o dono da sala reconhece o aparelho pelo endereço dele na rede), com pontos e respostas, sem digitar nome.
Se mesmo assim cair na tela de nome, é só usar o mesmo nome (acento/maiúscula não importam). O dono da sala pode tirar da lista (✕) quem caiu e não vai voltar. Votações e vezes não ficam esperando quem caiu.

Com 7+ pessoas, um **mini roteador de viagem** (ex.: GL.iNet Mango ou TP-Link TL-WR902AC, ligado num power bank) aguenta melhor que o roteador do celular:
liga o roteador, todo mundo (inclusive o dono da sala) conecta nele e o jogo roda no celular do dono do mesmo jeito.

## Stop: quem corrige
- **Juiz automático** (padrão): confere cada resposta num dicionário offline (`data/dicionario.json`: municípios e estados do IBGE, nomes do Censo, países, jogadores e clubes do Leilão e listas de animais, comidas, cores, profissões, marcas…). Aceita sem acento, plural e um erro de digitação. Só sorteia temas que ele sabe conferir. Se ele errar, a galera toca na resposta e muda por maioria.
- **Votação**: todos os temas na mesma tela, um relógio só; cada um marca as erradas e aperta "Pronto". Fecha quando todo mundo (que está conectado) apertou, quando o tempo acaba ou quando o dono da sala encerra.
- Pra aumentar o dicionário, edite `tools/listas_stop.py` e rode `python3 tools/build_dicionario.py municipios.csv estados.csv nomes-censos-ibge.csv`.

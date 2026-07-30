# ✦ LiveBot — Twitch multi-jogo

Bot de chat **bonito e prático** pra lives com vários jogos · Hallownest Bots.

```
HallownestBots/
  Morgana/   Discord
  Quirrel/   companhia no terminal
  LiveBot/   Twitch (+ OBS opcional)
```

---

## Subir em 1 minuto

```bash
cd ~/Documentos/HallownestBots/LiveBot
cp .env.example .env
# TWITCH_USERNAME / TWITCH_OAUTH / TWITCH_CHANNEL
npm install
npm start
```

### Tema de cores (terminal)

No `.env`:

```env
LIVEBOT_THEME=coral   # default — coral Morgana
# LIVEBOT_THEME=void  # abismo / roxo
# LIVEBOT_THEME=pale  # corte pálida / ouro
# LIVEBOT_THEME=moss  # greenpath / verde
```

O chat da Twitch **não** aceita cores no texto do bot — o tema pinta o **teu terminal** (banner, logs, comandos).  
No chat: `!tema` mostra qual está ativo.

Token: [twitchtokengenerator.com](https://twitchtokengenerator.com/) → **Bot Chat Token**.

No terminal vais ver um banner assim:

```
══════════════════════════════════════════════
  ✦ LiveBot  · Hallownest · v1.0.0
──────────────────────────────────────────────
  canal   #teu_canal
  bot     teubot
  jogo    Hades
  obs     OBS: conectado …
══════════════════════════════════════════════
```

---

## Multi-jogo (streamer / mod)

```text
!setlista Hades | Hollow Knight | Celeste | Stardew
!setjogo Hades
!setmeta 1 boss ou 2h de vibes
!settitulo Noite multi-jogo no hall
!dica build arco / fase difícil
!proximo          → próximo da lista (+ cena OBS)
!brb / !voltar
```

## Chat

| | |
|--|--|
| `!jogo` `!jogos` | jogo atual e roteiro |
| `!morte` `!win` `!stats` | contadores (mod +1 em morte/win) |
| `!meta` `!titulo` `!hype` `!lurk` | meta, tema, hype, lurk |
| `!oi` `!citacao` `!comandos` | acolhimento e lore |
| `!discord` `!pix`… | teus textos em `data/commands.json` |

Placeholders nos textos custom: `{user}` `{jogo}` `{meta}` `{mortes}`.

---

## OBS (opcional)

1. OBS → WebSocket ON (porta 4455 + senha)  
2. `.env`:
```env
OBS_ENABLED=1
OBS_URL=ws://127.0.0.1:4455
OBS_PASSWORD=...
OBS_GAME_TEXT_SOURCE=TextoJogo
```
3. Mapa em `data/obs-scenes.json` (jogo → cena)

| Comando | Efeito |
|---------|--------|
| `!setjogo` / `!proximo` | cena + texto |
| `!brb` / `!voltar` | cenas BRB / Live |
| `!cena Nome` | troca manual |
| `!obs` | status |

---

## Ficheiros

| Path | Função |
|------|--------|
| `src/style.js` | voz visual no chat (✦, limites Twitch) |
| `src/console-ui.js` | banner e logs coloridos |
| `data/state.json` | jogo, lista, mortes (persistente) |
| `data/commands.json` | respostas tuas |
| `data/obs-scenes.json` | mapa OBS |

---

## .env útil

```env
JOIN_MESSAGE=✦ Live no ar · {jogo} · !comandos
SILENT_JOIN=1
FIRST_CHAT_GREET=0
COMMAND_COOLDOWN_MS=3000
```

- `SILENT_JOIN=1` — não fala ao conectar  
- `FIRST_CHAT_GREET=1` — cumprimenta a 1ª msg de cada viewer (pode ser barulhento)

---

🕯️ *O fogo está aceso. Bom stream no hall.*

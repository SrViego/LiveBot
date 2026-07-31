# ✦ LiveBot — Twitch multi-jogo

Bot de chat **bonito e prático** pra lives com vários jogos · Hallownest Bots.

```
HallownestBots/
  Morgana/   Discord
  Quirrel/   companhia no terminal
  LiveBot/   Twitch (+ OBS + agradecimentos)
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
| `!pix` `!doar` | chave PIX / link de apoio |
| `!apoios` | follows, subs, bits e doações da sessão |
| `!discord`… | teus textos em `data/commands.json` |

Placeholders nos textos custom: `{user}` `{jogo}` `{meta}` `{mortes}`.

---

## Agradecimentos (follow, sub, bits, PIX)

O bot **agradece sozinho** quando detecta:

| Evento | Como chega | Precisa de |
|--------|------------|------------|
| **Sub / resub / gift** | IRC (tmi.js) | token de chat normal |
| **Bits (cheer)** | IRC | token de chat normal |
| **Raid** | IRC | token de chat normal |
| **Follow** | EventSub WebSocket | `TWITCH_CLIENT_ID` + scope `moderator:read:followers` + bot **MOD** |
| **PIX / doação** | chat ou comando | chave no `.env` / `alerts.json` |

### PIX e outros apoios

1. Coloca a chave ou link no `.env`:
```env
PIX_KEY=sua_chave_ou_https://livepix.gg/teuuser
```
   ou em `data/alerts.json` → `pixKey`.

2. Chat: `!pix` / `!doar` mostra a mensagem.

3. Quando alguém manda *“enviei pix”*, *“doei”*, etc., o bot agradece (lista em `donationKeywords` no `alerts.json`).

4. Mod/streamer: `!obrigado @nick` ou `!obrigado @nick R$10 valeu!`

Mensagens editáveis em **`data/alerts.json`** (`messages.follow`, `sub`, `cheer`, `donation`…).

### Follow (opcional)

```env
TWITCH_CLIENT_ID=xxxxx   # app em https://dev.twitch.tv/console
# Token com moderator:read:followers (e o bot como mod do canal)
# ALERTS_FOLLOW=0        # desliga
```

Sem Client-ID, o resto (sub/bits/raid/PIX) continua a funcionar.

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
| `src/alerts.js` | templates de obrigado + PIX |
| `src/events-twitch.js` | sub/bits/raid + EventSub follow |
| `data/state.json` | jogo, lista, mortes, apoios |
| `data/commands.json` | respostas tuas |
| `data/alerts.json` | mensagens de thank + chave PIX |
| `data/obs-scenes.json` | mapa OBS |

---

## .env útil

```env
JOIN_MESSAGE=✦ Live no ar · {jogo} · !comandos
SILENT_JOIN=1
FIRST_CHAT_GREET=0
COMMAND_COOLDOWN_MS=3000
PIX_KEY=sua_chave
TWITCH_CLIENT_ID=
ALERTS_FOLLOW=1
ALERTS_DONATION_AUTO=1
```

- `SILENT_JOIN=1` — não fala ao conectar  
- `FIRST_CHAT_GREET=1` — cumprimenta a 1ª msg de cada viewer (pode ser barulhento)
- `ALERTS_DONATION_AUTO=0` — não auto-agradece “enviei pix” no chat

---

🕯️ *O fogo está aceso. Bom stream no hall.*

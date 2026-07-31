# ✦ LiveBot — Twitch multi-jogo

Bot de chat pra lives com vários jogos · Hallownest Bots · v1.3

```
HallownestBots/
  Morgana/   Discord
  Quirrel/   terminal
  LiveBot/   Twitch (+ OBS + apoios + polls + pedidos)
```

---

## Subir

```bash
cd ~/Documentos/HallownestBots/LiveBot
cp .env.example .env
# TWITCH_USERNAME / TWITCH_OAUTH / TWITCH_CHANNEL
# opcional: TWITCH_CLIENT_ID (polls, !so com jogo, follows)
npm install
npm start
```

---

## Comandos chat

| | |
|--|--|
| `!jogo` `!jogos` | jogo e roteiro |
| `!morte` `!win` `!stats` | contadores |
| `!meta` | meta + barra `███░░ 60%` |
| `!pedido …` / `!pedidos` | fila de pedidos |
| `!pix` `!apoios` | apoio / contagem |
| `!hype` `!lurk` `!citacao` `!oi` | vibe |
| custom em `data/commands.json` | `{user}` `{jogo}` `{meta}` `{mortes}` · `"vip": true` |

### Mods

| | |
|--|--|
| `!setjogo` `!setlista` `!proximo` | multi-jogo + OBS |
| `!setmeta 50/100 reais` | meta com progresso |
| `!meta+ 10` / `!meta- 5` | ajusta progresso |
| `!pedido next` `skip` `clear` | fila |
| `!poll Pergunta \| A \| B` | **poll Twitch API** |
| `!poll end` | encerra poll |
| `!pred Título \| Sim \| Não` | **prediction API** |
| `!pred end` | cancela prediction |
| `!so @canal` | shoutout (+ last game se CLIENT_ID) |
| `!obrigado @nick R$10` | agradece doação |
| `!brb` `!voltar` `!cena` `!obs` | cena / BRB |

---

## Features

### Polls / predictions (Twitch API)
`TWITCH_CLIENT_ID` + token com `channel:manage:polls` e/ou `channel:manage:predictions`.

### Clip reminder
A cada 30 min (default): lembrete de clip.  
`CLIP_REMINDER=0` desliga · `CLIP_REMINDER_MS=1800000`

### Visitantes
Conta visitas multi-live. Com `FIRST_CHAT_GREET=1` cumprimenta a 1ª.  
Revisitas: “3ª visita no hall”. `VISITOR_GREET=0` desliga revisitas.

### Meta com progresso
```text
!setmeta 0/100 reais
!meta+ 25
!meta
→ Meta: 25/100 reais · ██░░░░░░░░ 25%
```

### Pedidos
```text
!pedido joga Celeste
!pedidos
!pedido next   (mod)
```

### LivePix webhook
```env
LIVEPIX_WEBHOOK_PORT=8787
# POST http://127.0.0.1:8787/  JSON com username + amount
```
Opcional: tunnel (cloudflared/ngrok) se a LivePix precisar de URL pública.

### Cooldowns
- Global por comando: `COMMAND_COOLDOWN_MS`
- Por user+comando: `USER_COOLDOWN_MS`  
Mods ignoram (exceto `!hype`).

### VIP / sub only
Em `commands.json`:
```json
"segredo": { "vip": true, "response": "Só sub/VIP, {user}!" }
```

### Dashboard + backup
- Terminal atualiza status a cada 15s (`DASHBOARD=0` off)
- Ao sair (Ctrl+C): resumo + backup em `data/backups/`
- `SESSION_SUMMARY_CHAT=1` manda resumo no chat

### Agradecimentos
Sub/bits/raid (IRC) · follow (EventSub) · PIX (chat/mod/webhook)

### OBS
`OBS_ENABLED=1` + `data/obs-scenes.json`

---

## Ficheiros

| Path | |
|------|--|
| `src/twitch-api.js` | Helix polls/pred/so |
| `src/session.js` | meta bar + backup |
| `src/visitors.js` | visitas |
| `src/clips-reminder.js` | clips |
| `src/webhook-livepix.js` | doações HTTP |
| `src/dashboard.js` | status terminal |
| `data/alerts.json` | msgs de thank |
| `data/commands.json` | textos custom (+ vip) |
| `data/backups/` | state por sessão |

---

🕯️ *O fogo está aceso. Bom stream no hall.*

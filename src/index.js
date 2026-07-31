/**
 * ✦ LiveBot — Twitch multi-jogo + OBS + agradecimentos (Hallownest Bots)
 */

require('dotenv').config();
const tmi = require('tmi.js');
const { resolveCommand, gameLine } = require('./commands');
const state = require('./state');
const obs = require('./obs');
const ui = require('./console-ui');
const S = require('./style');
const alerts = require('./alerts');
const {
  attachIrcEvents,
  startFollowListener,
  bumpThanks
} = require('./events-twitch');

const username = (process.env.TWITCH_USERNAME || '').toLowerCase().trim();
const password = (process.env.TWITCH_OAUTH || '').trim();
const channel = (process.env.TWITCH_CHANNEL || '').toLowerCase().replace(/^#/, '').trim();
const PREFIX = process.env.COMMAND_PREFIX || '!';
const JOIN_MESSAGE = (process.env.JOIN_MESSAGE || '').trim();
const COOLDOWN = Number(process.env.COMMAND_COOLDOWN_MS || 3000);
const FIRST_CHAT_GREET = process.env.FIRST_CHAT_GREET === '1';
const DONATION_AUTO = process.env.ALERTS_DONATION_AUTO !== '0';
const DONATION_CD_MS = Number(process.env.DONATION_THANK_COOLDOWN_MS || 60000);

if (!username || !password || !channel) {
  ui.err('Falta config no .env');
  console.error(`
  TWITCH_USERNAME=  nick do bot
  TWITCH_OAUTH=oauth:...
  TWITCH_CHANNEL=   teu canal

  Token: https://twitchtokengenerator.com/  → Bot Chat Token
  cp .env.example .env
`);
  process.exit(1);
}

if (!password.startsWith('oauth:')) {
  ui.warn('TWITCH_OAUTH deve começar com oauth:');
}

const startedAt = Date.now();
const cooldowns = new Map();
const greeted = new Set();
const donationCd = new Map();
let messagesHandled = 0;
let followWs = null;

state.get();

ui.banner({
  channel,
  bot: username,
  game: state.get().currentGame,
  obsLine: obs.statusLine(),
  prefix: PREFIX
});
if (process.env.DEBUG === '1') ui.themePreview();

const client = new tmi.Client({
  options: { debug: process.env.DEBUG === '1' },
  connection: { reconnect: true, secure: true },
  identity: { username, password },
  channels: [channel]
});

function isMod(tags) {
  return (
    tags.mod === true ||
    tags.badges?.broadcaster === '1' ||
    tags.username === channel
  );
}

function isSubOrVip(tags) {
  return (
    tags.subscriber === true ||
    tags.badges?.vip === '1' ||
    tags.badges?.premium === '1'
  );
}

async function say(msg) {
  if (!msg) return;
  try {
    await client.say(`#${channel}`, S.clip(msg));
  } catch (err) {
    ui.err(`say: ${err.message}`);
  }
}

// Sub / bits / raid / gift
attachIrcEvents(client, say);

client.on('connected', (addr, port) => {
  ui.ok(`Twitch ${addr}:${port} → #${channel}`);
  if (obs.isEnabled()) {
    obs
      .connect()
      .then((ok) => {
        if (ok) ui.ok(obs.statusLine());
        else ui.warn(obs.statusLine());
      })
      .catch(() => ui.warn('OBS não conectou'));
  } else {
    ui.info('OBS desligado (OBS_ENABLED=1 no .env)');
  }

  // Follow via EventSub (opcional — precisa TWITCH_CLIENT_ID + scope)
  startFollowListener({
    clientId: (process.env.TWITCH_CLIENT_ID || '').trim(),
    oauth: password,
    channelLogin: channel,
    say
  })
    .then((ws) => {
      followWs = ws;
    })
    .catch((err) => ui.warn(`Follow listener: ${err.message}`));
});

client.on('join', (ch, user, self) => {
  if (!self) return;
  ui.ok(`Entrou em ${ch}`);
  if (JOIN_MESSAGE) {
    const msg = JOIN_MESSAGE.replace(
      /\{jogo\}/gi,
      state.get().currentGame || 'vários jogos'
    );
    client.say(ch, S.clip(msg)).catch((err) => ui.err(err.message));
  } else {
    const g = state.get().currentGame;
    const defaultJoin = S.say(
      g
        ? `Live no ar · ${g} · digita !comandos · !pix`
        : `Live multi-jogo no ar · !comandos · !jogo · !pix`,
      { icon: S.ICONS.heart }
    );
    if (process.env.SILENT_JOIN !== '1') {
      client.say(ch, defaultJoin).catch(() => {});
    }
  }
});

client.on('message', async (ch, tags, message, self) => {
  if (self) return;

  const user = tags['display-name'] || tags.username || 'alguém';
  const uid = tags['user-id'] || tags.username;
  const mod = isMod(tags);

  // primeiro chat da sessão (opcional)
  if (
    FIRST_CHAT_GREET &&
    uid &&
    !greeted.has(uid) &&
    !message.startsWith(PREFIX) &&
    !mod
  ) {
    greeted.add(uid);
    const text = S.welcome(user, state.get().currentGame);
    try {
      await client.say(ch, text);
      ui.cmdLog(user, '(welcome)', true);
    } catch {
      /* ignore */
    }
    return;
  }

  if (uid) greeted.add(uid);

  // Heurística: "enviei pix" / "doei" etc. → agradece (com cooldown)
  if (
    DONATION_AUTO &&
    !message.startsWith(PREFIX) &&
    alerts.looksLikeDonationMessage(message)
  ) {
    const now = Date.now();
    const last = donationCd.get(uid) || 0;
    if (now - last >= DONATION_CD_MS) {
      donationCd.set(uid, now);
      const text = alerts.donationThank(user);
      if (text) {
        try {
          await client.say(ch, text);
          bumpThanks('donation');
          messagesHandled += 1;
          ui.ok(`doação (chat) · ${user}`);
        } catch (err) {
          ui.err(`say: ${err.message}`);
        }
      }
    }
    return;
  }

  if (!message.startsWith(PREFIX)) return;

  const body = message.slice(PREFIX.length).trim();
  if (!body) return;
  const parts = body.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);

  const now = Date.now();
  const last = cooldowns.get(name) || 0;
  const skipCd = mod && name !== 'hype';
  if (!skipCd && now - last < COOLDOWN) return;
  cooldowns.set(name, now);

  const result = await resolveCommand(name, {
    user,
    args,
    startedAt,
    mod,
    vip: isSubOrVip(tags)
  });

  if (!result.text) return;
  if (result.isModOnly && !mod) return;

  try {
    await client.say(ch, S.clip(result.text));
    messagesHandled += 1;
    ui.cmdLog(user, name, true);
  } catch (err) {
    ui.err(`say: ${err.message}`);
  }
});

client.on('disconnected', (reason) => {
  ui.warn(`Desconectado: ${reason || '—'}`);
});

client.on('reconnect', () => {
  ui.info('A reconectar…');
});

client.connect().catch((err) => {
  ui.err(`Falha ao conectar: ${err.message}`);
  console.error('  Confere username, oauth (chat:read + chat:edit).');
  process.exit(1);
});

function shutdown() {
  console.log('');
  const t = state.get().thanks || {};
  const thanksBits = [
    t.follow && `${t.follow} follows`,
    t.sub && `${t.sub} subs`,
    t.bits && `${t.bits} bits`,
    t.donation && `${t.donation} doações`
  ]
    .filter(Boolean)
    .join(' · ');
  ui.info(
    `Sessão: ${messagesHandled} respostas${thanksBits ? ` · ${thanksBits}` : ''} · tchau do hall`
  );
  try {
    if (followWs && followWs.readyState === 1) followWs.close();
  } catch {
    /* ignore */
  }
  client.disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

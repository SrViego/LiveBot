/**
 * ✦ LiveBot — Twitch multi-jogo + OBS (Hallownest Bots)
 */

require('dotenv').config();
const tmi = require('tmi.js');
const { resolveCommand, gameLine } = require('./commands');
const state = require('./state');
const obs = require('./obs');
const ui = require('./console-ui');
const S = require('./style');

const username = (process.env.TWITCH_USERNAME || '').toLowerCase().trim();
const password = (process.env.TWITCH_OAUTH || '').trim();
const channel = (process.env.TWITCH_CHANNEL || '').toLowerCase().replace(/^#/, '').trim();
const PREFIX = process.env.COMMAND_PREFIX || '!';
const JOIN_MESSAGE = (process.env.JOIN_MESSAGE || '').trim();
const COOLDOWN = Number(process.env.COMMAND_COOLDOWN_MS || 3000);
const FIRST_CHAT_GREET = process.env.FIRST_CHAT_GREET === '1';

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
let messagesHandled = 0;

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
    // mensagem de entrada elegante por defeito
    const g = state.get().currentGame;
    const defaultJoin = S.say(
      g
        ? `Live no ar · ${g} · digita !comandos`
        : `Live multi-jogo no ar · !comandos · !jogo`,
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

  // primeiro chat da sessão (opcional) — só se FIRST_CHAT_GREET=1
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
  ui.info(`Sessão: ${messagesHandled} respostas · tchau do hall`);
  client.disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

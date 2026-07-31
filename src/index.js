/**
 * ✦ LiveBot — Twitch multi-jogo + OBS + agradecimentos + QoL (Hallownest Bots)
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
const visitors = require('./visitors');
const { startClipReminder } = require('./clips-reminder');
const { startLivePixWebhook } = require('./webhook-livepix');
const { startDashboard } = require('./dashboard');
const { backupState, buildSummary } = require('./session');

const username = (process.env.TWITCH_USERNAME || '').toLowerCase().trim();
const password = (process.env.TWITCH_OAUTH || '').trim();
const channel = (process.env.TWITCH_CHANNEL || '').toLowerCase().replace(/^#/, '').trim();
const PREFIX = process.env.COMMAND_PREFIX || '!';
const JOIN_MESSAGE = (process.env.JOIN_MESSAGE || '').trim();
const COOLDOWN = Number(process.env.COMMAND_COOLDOWN_MS || 3000);
const USER_COOLDOWN = Number(process.env.USER_COOLDOWN_MS || 5000);
const FIRST_CHAT_GREET = process.env.FIRST_CHAT_GREET === '1';
const VISITOR_GREET = process.env.VISITOR_GREET !== '0';
const DONATION_AUTO = process.env.ALERTS_DONATION_AUTO !== '0';
const DONATION_CD_MS = Number(process.env.DONATION_THANK_COOLDOWN_MS || 60000);
const SESSION_SUMMARY_CHAT = process.env.SESSION_SUMMARY_CHAT === '1';

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
/** cooldown global por comando */
const cooldowns = new Map();
/** cooldown por user+comando */
const userCooldowns = new Map();
const donationCd = new Map();
let messagesHandled = 0;
let followWs = null;
let clipRem = null;
let webhook = null;
let dash = null;

state.get();
visitors.startSession();

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
    tags.badges?.premium === '1' ||
    tags.badges?.founder === '1'
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

  clipRem = startClipReminder({ say });
  webhook = startLivePixWebhook({ say });
  dash = startDashboard(() => ({ messagesHandled, startedAt }));

  if (process.env.CLIP_REMINDER !== '0') {
    ui.info(
      `Clip reminder: cada ${Math.round(Number(process.env.CLIP_REMINDER_MS || 1.8e6) / 60000)} min`
    );
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
    const g = state.get().currentGame;
    const defaultJoin = S.say(
      g
        ? `Live no ar · ${g} · !comandos · !pix · !pedido`
        : `Live multi-jogo no ar · !comandos · !jogo · !pedido · !pix`,
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
  const vip = isSubOrVip(tags);

  // visitantes / Xª visita (1 anúncio por sessão de bot)
  if (uid && !message.startsWith(PREFIX) && !mod) {
    const v = visitors.noteChat(uid, user);
    if (v.isNewSession && v.text) {
      const greetFirst = FIRST_CHAT_GREET && v.visit === 1;
      const greetReturn = VISITOR_GREET && v.visit > 1;
      if (greetFirst || greetReturn) {
        try {
          const text = greetFirst
            ? S.welcome(user, state.get().currentGame)
            : v.text;
          await client.say(ch, text);
          messagesHandled += 1;
          ui.cmdLog(user, greetFirst ? '(welcome)' : `(visita ${v.visit})`, true);
        } catch {
          /* ignore */
        }
        return;
      }
    }
  }

  // Heurística doação no chat
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
          dash?.refresh?.();
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
  // cooldown global por comando
  const lastCmd = cooldowns.get(name) || 0;
  // cooldown por user
  const ukey = `${uid}:${name}`;
  const lastUser = userCooldowns.get(ukey) || 0;
  const skipCd = mod && name !== 'hype';
  if (!skipCd) {
    if (now - lastCmd < COOLDOWN) return;
    if (USER_COOLDOWN > 0 && now - lastUser < USER_COOLDOWN) return;
  }
  cooldowns.set(name, now);
  userCooldowns.set(ukey, now);

  const result = await resolveCommand(name, {
    user,
    args,
    startedAt,
    mod,
    vip
  });

  if (!result.text) return;
  if (result.isModOnly && !mod) return;
  // vip-only already answered with message or null

  try {
    await client.say(ch, S.clip(result.text));
    messagesHandled += 1;
    ui.cmdLog(user, name, true);
    dash?.refresh?.();
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

async function shutdown() {
  console.log('');
  const summary = buildSummary({ startedAt, messagesHandled });
  const bak = backupState();
  ui.info(`Resumo: ${summary}`);
  if (bak) ui.ok(`Backup: ${bak}`);
  if (SESSION_SUMMARY_CHAT) {
    try {
      await say(S.say(`Fim da sessão · ${summary}`, { icon: S.ICONS.heart }));
    } catch {
      /* ignore */
    }
  }
  try {
    clipRem?.stop?.();
    webhook?.stop?.();
    dash?.stop?.();
    if (followWs && followWs.readyState === 1) followWs.close();
  } catch {
    /* ignore */
  }
  client.disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', () => {
  shutdown();
});
process.on('SIGTERM', () => {
  shutdown();
});

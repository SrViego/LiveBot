/**
 * Eventos Twitch: IRC (sub/bits/raid) + EventSub WebSocket (follow).
 */

const alerts = require('./alerts');
const ui = require('./console-ui');
const state = require('./state');

function stripOauth(token) {
  return String(token || '').replace(/^oauth:/i, '').trim();
}

function bumpThanks(kind, amount = 1) {
  const s = state.get();
  if (!s.thanks) {
    s.thanks = { follow: 0, sub: 0, gift: 0, bits: 0, raid: 0, donation: 0 };
  }
  if (kind === 'bits') s.thanks.bits = (s.thanks.bits || 0) + amount;
  else s.thanks[kind] = (s.thanks[kind] || 0) + 1;
  state.persist();
  return s.thanks;
}

/**
 * Liga handlers tmi.js (subs, bits, raid).
 * @param {import('tmi.js').Client} client
 * @param {(msg: string) => Promise<void>} say
 */
function attachIrcEvents(client, say) {
  client.on('subscription', async (_ch, username, _method, _msg, tags) => {
    const user = tags?.['display-name'] || username;
    const text = alerts.formatAlert('sub', { user });
    if (text) {
      await say(text);
      bumpThanks('sub');
      ui.ok(`sub · ${user}`);
    }
  });

  client.on('resub', async (_ch, username, months, _msg, tags) => {
    const user = tags?.['display-name'] || username;
    const text = alerts.formatAlert('resub', {
      user,
      months: months || tags?.['msg-param-cumulative-months'] || '?'
    });
    if (text) {
      await say(text);
      bumpThanks('sub');
      ui.ok(`resub · ${user} (${months})`);
    }
  });

  client.on('subgift', async (_ch, username, _streak, recipient, _methods, tags) => {
    const user = tags?.['display-name'] || username;
    const rec = recipient ? ` pra ${recipient}` : '';
    const text = alerts.formatAlert('giftsub', {
      user,
      recipient: rec
    });
    if (text) {
      await say(text);
      bumpThanks('gift');
      ui.ok(`gift · ${user}${rec}`);
    }
  });

  client.on('submysterygift', async (_ch, username, numbOfSubs) => {
    const text = alerts.formatAlert('giftsub', {
      user: username,
      recipient: numbOfSubs > 1 ? ` (${numbOfSubs} subs)` : ''
    });
    if (text) {
      await say(text);
      bumpThanks('gift');
      ui.ok(`mystery gift · ${username} x${numbOfSubs}`);
    }
  });

  client.on('cheer', async (_ch, tags, message) => {
    const bits = Number(tags.bits || 0);
    const cfg = alerts.load();
    if (bits < (cfg.minBitsToThank || 1)) return;
    const user = tags['display-name'] || tags.username || 'alguém';
    const text = alerts.formatAlert('cheer', { user, bits });
    if (text) {
      await say(text);
      bumpThanks('bits', bits);
      ui.ok(`cheer · ${user} ${bits} bits`);
    }
  });

  client.on('raided', async (_ch, username, viewers) => {
    const text = alerts.formatAlert('raid', {
      user: username,
      viewers: viewers || '?'
    });
    if (text) {
      await say(text);
      bumpThanks('raid');
      ui.ok(`raid · ${username} (${viewers})`);
    }
  });
}

/**
 * EventSub WebSocket — follows (precisa Client-ID + token com moderator:read:followers).
 * O bot deve ser moderador do canal.
 */
async function startFollowListener({ clientId, oauth, channelLogin, say }) {
  if (process.env.ALERTS_FOLLOW === '0') {
    ui.info('Follow alerts desligados (ALERTS_FOLLOW=0)');
    return null;
  }
  if (!clientId) {
    ui.info(
      'Follow: define TWITCH_CLIENT_ID no .env (app em dev.twitch.tv) p/ agradecer follows'
    );
    return null;
  }

  const token = stripOauth(oauth);
  const headers = {
    'Client-ID': clientId,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  let broadcasterId;
  let moderatorId;
  try {
    const logins = [
      channelLogin,
      process.env.TWITCH_USERNAME || ''
    ]
      .filter(Boolean)
      .map((l) => `login=${encodeURIComponent(l)}`)
      .join('&');
    const uRes = await fetch(`https://api.twitch.tv/helix/users?${logins}`, {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` }
    });
    const uJson = await uRes.json();
    const users = uJson.data || [];
    const broadcaster = users.find(
      (u) => u.login?.toLowerCase() === channelLogin.toLowerCase()
    );
    const botUser = users.find(
      (u) =>
        u.login?.toLowerCase() ===
        (process.env.TWITCH_USERNAME || '').toLowerCase()
    );
    broadcasterId = broadcaster?.id;
    moderatorId = botUser?.id || broadcaster?.id;
    if (!broadcasterId) {
      ui.warn('Follow: não achei o user do canal na API');
      return null;
    }
  } catch (err) {
    ui.warn(`Follow: falha users API — ${err.message}`);
    return null;
  }

  let WebSocket;
  try {
    WebSocket = require('ws');
  } catch {
    ui.warn('Follow: instala o pacote ws (`npm install ws`)');
    return null;
  }

  const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  ws.on('open', () => {
    ui.info('EventSub WebSocket a ligar (follows)…');
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const type = msg.metadata?.message_type;

    if (type === 'session_welcome') {
      const sessionId = msg.payload?.session?.id;
      if (!sessionId) return;
      try {
        const res = await fetch(
          'https://api.twitch.tv/helix/eventsub/subscriptions',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              type: 'channel.follow',
              version: '2',
              condition: {
                broadcaster_user_id: broadcasterId,
                moderator_user_id: moderatorId
              },
              transport: {
                method: 'websocket',
                session_id: sessionId
              }
            })
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          ui.warn(
            `Follow sub falhou (${res.status}): ${body?.message || JSON.stringify(body).slice(0, 120)}`
          );
          ui.info(
            'Dica: bot deve ser MOD · token com scope moderator:read:followers · Client-ID da mesma app do token'
          );
          return;
        }
        ui.ok('A seguir follows do canal (EventSub)');
      } catch (err) {
        ui.warn(`Follow subscribe: ${err.message}`);
      }
      return;
    }

    if (
      type === 'notification' &&
      msg.metadata?.subscription_type === 'channel.follow'
    ) {
      const e = msg.payload?.event;
      const user = e?.user_name || e?.user_login || 'alguém';
      const text = alerts.formatAlert('follow', { user });
      if (text) {
        await say(text);
        bumpThanks('follow');
        ui.ok(`follow · ${user}`);
      }
    }

    if (type === 'session_reconnect') {
      ui.warn('EventSub pediu reconnect — reinicia o bot se follows pararem');
    }
  });

  ws.on('error', (err) => {
    ui.warn(`EventSub WS: ${err.message}`);
  });

  ws.on('close', () => {
    ui.warn('EventSub WS fechou');
  });

  return ws;
}

module.exports = {
  attachIrcEvents,
  startFollowListener,
  bumpThanks,
  stripOauth
};

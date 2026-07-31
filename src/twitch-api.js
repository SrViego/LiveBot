/**
 * Helix API helpers (polls, predictions, shoutout, users).
 */

function stripOauth(token) {
  return String(token || '').replace(/^oauth:/i, '').trim();
}

function clientId() {
  return (process.env.TWITCH_CLIENT_ID || '').trim();
}

function oauth() {
  return stripOauth(process.env.TWITCH_OAUTH || '');
}

function headers() {
  const id = clientId();
  const token = oauth();
  if (!id || !token) return null;
  return {
    'Client-ID': id,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function isReady() {
  return Boolean(headers());
}

async function helix(path, { method = 'GET', body } = {}) {
  const h = headers();
  if (!h) {
    return {
      ok: false,
      status: 0,
      error: 'Define TWITCH_CLIENT_ID + TWITCH_OAUTH (mesma app)'
    };
  }
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json?.message || json?.error || JSON.stringify(json).slice(0, 160),
      json
    };
  }
  return { ok: true, status: res.status, data: json.data, json };
}

const idCache = new Map();

async function getUserByLogin(login) {
  const key = String(login || '')
    .toLowerCase()
    .replace(/^@/, '')
    .trim();
  if (!key) return null;
  if (idCache.has(key)) return idCache.get(key);
  const r = await helix(`/users?login=${encodeURIComponent(key)}`);
  if (!r.ok || !r.data?.[0]) return null;
  idCache.set(key, r.data[0]);
  return r.data[0];
}

async function getBroadcaster() {
  const ch = (process.env.TWITCH_CHANNEL || '').toLowerCase().replace(/^#/, '');
  return getUserByLogin(ch);
}

/** Canal + último jogo (Helix channel). */
async function getChannelInfo(login) {
  const user = await getUserByLogin(login);
  if (!user) return { ok: false, error: `User @${login} não encontrado` };
  const r = await helix(`/channels?broadcaster_id=${user.id}`);
  if (!r.ok) return { ok: false, error: r.error };
  const ch = r.data?.[0] || {};
  return {
    ok: true,
    user,
    game: ch.game_name || null,
    title: ch.title || null,
    login: user.login,
    displayName: user.display_name || user.login
  };
}

/**
 * Cria poll Twitch.
 * @param {string} title
 * @param {string[]} choices 2–5
 * @param {number} durationSec 15–1800
 */
async function createPoll(title, choices, durationSec = 60) {
  const broadcaster = await getBroadcaster();
  if (!broadcaster) return { ok: false, error: 'Não achei o broadcaster (TWITCH_CHANNEL)' };
  const clean = choices.map((c) => String(c).slice(0, 25)).filter(Boolean);
  if (clean.length < 2 || clean.length > 5) {
    return { ok: false, error: 'Poll precisa de 2 a 5 opções' };
  }
  const dur = Math.min(1800, Math.max(15, Number(durationSec) || 60));
  return helix('/polls', {
    method: 'POST',
    body: {
      broadcaster_id: broadcaster.id,
      title: String(title).slice(0, 60),
      choices: clean.map((title) => ({ title })),
      duration: dur
    }
  });
}

async function endPoll(status = 'TERMINATED') {
  const broadcaster = await getBroadcaster();
  if (!broadcaster) return { ok: false, error: 'Sem broadcaster' };
  const list = await helix(
    `/polls?broadcaster_id=${broadcaster.id}&first=1`
  );
  if (!list.ok) return list;
  const poll = list.data?.[0];
  if (!poll || poll.status === 'COMPLETED' || poll.status === 'TERMINATED') {
    return { ok: false, error: 'Nenhuma poll ativa' };
  }
  return helix('/polls', {
    method: 'PATCH',
    body: {
      broadcaster_id: broadcaster.id,
      id: poll.id,
      status // TERMINATED | ARCHIVED
    }
  });
}

/**
 * Prediction (2 outcomes simples).
 */
async function createPrediction(title, outcomes, windowSec = 60) {
  const broadcaster = await getBroadcaster();
  if (!broadcaster) return { ok: false, error: 'Sem broadcaster' };
  const clean = outcomes.map((c) => String(c).slice(0, 25)).filter(Boolean);
  if (clean.length < 2 || clean.length > 10) {
    return { ok: false, error: 'Prediction: 2 a 10 outcomes' };
  }
  const win = Math.min(1800, Math.max(30, Number(windowSec) || 60));
  return helix('/predictions', {
    method: 'POST',
    body: {
      broadcaster_id: broadcaster.id,
      title: String(title).slice(0, 45),
      outcomes: clean.map((title) => ({ title })),
      prediction_window: win
    }
  });
}

async function endPrediction(status = 'CANCELED') {
  const broadcaster = await getBroadcaster();
  if (!broadcaster) return { ok: false, error: 'Sem broadcaster' };
  const list = await helix(
    `/predictions?broadcaster_id=${broadcaster.id}&first=1`
  );
  if (!list.ok) return list;
  const pred = list.data?.[0];
  if (!pred || !['ACTIVE', 'LOCKED'].includes(pred.status)) {
    return { ok: false, error: 'Nenhuma prediction ativa' };
  }
  return helix('/predictions', {
    method: 'PATCH',
    body: {
      broadcaster_id: broadcaster.id,
      id: pred.id,
      status // RESOLVED | CANCELED | LOCKED
    }
  });
}

module.exports = {
  stripOauth,
  clientId,
  isReady,
  helix,
  getUserByLogin,
  getBroadcaster,
  getChannelInfo,
  createPoll,
  endPoll,
  createPrediction,
  endPrediction
};

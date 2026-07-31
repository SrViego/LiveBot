/**
 * Visitantes / “Xª visita no hall”.
 */

const state = require('./state');
const S = require('./style');

function ensure() {
  const s = state.get();
  if (!s.visitors || typeof s.visitors !== 'object') s.visitors = {};
  return s;
}

/**
 * Regista chat. Retorna mensagem de boas-vindas ou null.
 * @returns {{ text: string|null, visit: number, isNewSession: boolean }}
 */
function noteChat(uid, displayName) {
  if (!uid) return { text: null, visit: 0, isNewSession: false };
  const s = ensure();
  const key = String(uid);
  const now = Date.now();
  const prev = s.visitors[key];
  const sessionKey = s.sessionId || String(s.updatedAt || now);

  if (!prev) {
    s.visitors[key] = {
      name: displayName,
      visits: 1,
      lastSeen: now,
      lastSession: sessionKey
    };
    state.persist();
    return {
      text: S.say(
        `Bem-vindo(a) ao hall, ${displayName}! 1ª visita registada 🕯️`,
        { icon: S.ICONS.heart }
      ),
      visit: 1,
      isNewSession: true
    };
  }

  // já falou nesta sessão do bot
  if (prev.lastSession === sessionKey) {
    prev.lastSeen = now;
    prev.name = displayName || prev.name;
    return { text: null, visit: prev.visits || 1, isNewSession: false };
  }

  prev.visits = (prev.visits || 1) + 1;
  prev.lastSession = sessionKey;
  prev.lastSeen = now;
  prev.name = displayName || prev.name;
  state.persist();

  const n = prev.visits;
  const game = s.currentGame ? ` · ${s.currentGame}` : '';
  return {
    text: S.say(
      `${displayName} de volta! ${n}ª visita no hall${game}. Valeu por voltar 🕯️`,
      { icon: S.ICONS.heart }
    ),
    visit: n,
    isNewSession: true
  };
}

function startSession() {
  const s = ensure();
  s.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // não zera visitors — contagem multi-live
  state.persist();
  return s.sessionId;
}

module.exports = {
  noteChat,
  startSession
};

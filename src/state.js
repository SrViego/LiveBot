/**
 * Estado da live (vários jogos, contadores, meta, pedidos, visitantes).
 * Persistido em data/state.json
 */

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'data', 'state.json');

const defaultState = () => ({
  currentGame: null,
  playlist: [],
  playlistIndex: 0,
  counters: {
    morte: 0,
    win: 0,
    hype: 0
  },
  gameNotes: {},
  title: null,
  /** texto livre da meta (compat) */
  meta: null,
  /** meta com progresso: { label, current, target, unit } */
  metaGoal: null,
  /** fila de pedidos do chat */
  requests: [],
  /** visitantes multi-live: { [userId]: { name, visits, lastSeen, lastSession } } */
  visitors: {},
  /** id da sessão do bot (reinicia a cada start) */
  sessionId: null,
  brb: false,
  brbMessage: 'Já volto — o prego precisa afiar. 🕯️',
  thanks: {
    follow: 0,
    sub: 0,
    gift: 0,
    bits: 0,
    raid: 0,
    donation: 0
  },
  updatedAt: 0
});

function load() {
  try {
    if (!fs.existsSync(file)) return defaultState();
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const base = defaultState();
    return {
      ...base,
      ...raw,
      counters: { ...base.counters, ...(raw.counters || {}) },
      thanks: { ...base.thanks, ...(raw.thanks || {}) },
      visitors: raw.visitors && typeof raw.visitors === 'object' ? raw.visitors : {},
      requests: Array.isArray(raw.requests) ? raw.requests : []
    };
  } catch {
    return defaultState();
  }
}

function save(st) {
  st.updatedAt = Date.now();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(st, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function get() {
  if (!get._cache) get._cache = load();
  return get._cache;
}

function persist() {
  save(get());
}

function setGame(name) {
  const s = get();
  s.currentGame = name ? String(name).slice(0, 80) : null;
  s.brb = false;
  if (s.currentGame && s.playlist.length) {
    const i = s.playlist.findIndex(
      (g) => g.toLowerCase() === s.currentGame.toLowerCase()
    );
    if (i >= 0) s.playlistIndex = i;
  }
  persist();
  return s.currentGame;
}

function formatPlaylist(s = get()) {
  if (!s.playlist.length) return 'Lista vazia. Mod: !addjogo Nome · !setlista A | B | C';
  return s.playlist
    .map((g, i) => {
      const cur =
        s.currentGame && g.toLowerCase() === s.currentGame.toLowerCase()
          ? ' ← agora'
          : i === s.playlistIndex
            ? ' ← fila'
            : '';
      return `${i + 1}. ${g}${cur}`;
    })
    .join(' · ');
}

module.exports = {
  file,
  load,
  save,
  get,
  persist,
  setGame,
  formatPlaylist,
  defaultState
};

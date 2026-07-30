/**
 * Estado da live (vários jogos, contadores, meta).
 * Persistido em data/state.json
 */

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'data', 'state.json');

const defaultState = () => ({
  /** Jogo atual na live */
  currentGame: null,
  /** Fila / rotação da live */
  playlist: [],
  /** índice na playlist (se usar !proximo) */
  playlistIndex: 0,
  /** contadores por nome */
  counters: {
    morte: 0,
    win: 0,
    hype: 0
  },
  /** notas por jogo: { "Hades": "build atual: …" } */
  gameNotes: {},
  /** título/tema da live */
  title: null,
  /** meta da live */
  meta: null,
  /** BRB */
  brb: false,
  brbMessage: 'Já volto — o prego precisa afiar. 🕯️',
  updatedAt: 0
});

function load() {
  try {
    if (!fs.existsSync(file)) return defaultState();
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function save(state) {
  state.updatedAt = Date.now();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
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
  // se o jogo está na playlist, sincroniza índice
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

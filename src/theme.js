/**
 * Temas de cor do terminal LiveBot.
 * Twitch chat não pinta texto do bot — isto é a UI no teu PC.
 *
 * .env: LIVEBOT_THEME=coral | void | pale | moss
 */

const THEMES = {
  /** Morgana / wallpaper — coral + laranja (default) */
  coral: {
    name: 'Coral · Hallownest',
    primary: '\x1b[38;5;209m', // coral
    accent: '\x1b[38;5;215m', // peach/gold
    success: '\x1b[38;5;114m',
    warn: '\x1b[38;5;221m',
    error: '\x1b[38;5;167m',
    info: '\x1b[38;5;110m',
    muted: '\x1b[38;5;245m',
    text: '\x1b[38;5;255m',
    border: '\x1b[38;5;173m',
    brand: '\x1b[1m\x1b[38;5;209m',
    user: '\x1b[38;5;223m',
    cmd: '\x1b[38;5;216m',
    game: '\x1b[38;5;180m',
    bgSoft: '\x1b[48;5;52m'
  },
  /** Abismo / vazio */
  void: {
    name: 'Void · Abismo',
    primary: '\x1b[38;5;141m', // lilac
    accent: '\x1b[38;5;99m',
    success: '\x1b[38;5;85m',
    warn: '\x1b[38;5;178m',
    error: '\x1b[38;5;203m',
    info: '\x1b[38;5;117m',
    muted: '\x1b[38;5;240m',
    text: '\x1b[38;5;252m',
    border: '\x1b[38;5;60m',
    brand: '\x1b[1m\x1b[38;5;141m',
    user: '\x1b[38;5;189m',
    cmd: '\x1b[38;5;147m',
    game: '\x1b[38;5;183m',
    bgSoft: '\x1b[48;5;54m'
  },
  /** Pale Court — branco/ouro frio */
  pale: {
    name: 'Pale · Corte Pálida',
    primary: '\x1b[38;5;229m',
    accent: '\x1b[38;5;222m',
    success: '\x1b[38;5;157m',
    warn: '\x1b[38;5;228m',
    error: '\x1b[38;5;210m',
    info: '\x1b[38;5;159m',
    muted: '\x1b[38;5;246m',
    text: '\x1b[38;5;255m',
    border: '\x1b[38;5;187m',
    brand: '\x1b[1m\x1b[38;5;229m',
    user: '\x1b[38;5;230m',
    cmd: '\x1b[38;5;223m',
    game: '\x1b[38;5;193m',
    bgSoft: '\x1b[48;5;236m'
  },
  /** Greenpath */
  moss: {
    name: 'Moss · Greenpath',
    primary: '\x1b[38;5;114m',
    accent: '\x1b[38;5;150m',
    success: '\x1b[38;5;78m',
    warn: '\x1b[38;5;185m',
    error: '\x1b[38;5;167m',
    info: '\x1b[38;5;80m',
    muted: '\x1b[38;5;243m',
    text: '\x1b[38;5;254m',
    border: '\x1b[38;5;65m',
    brand: '\x1b[1m\x1b[38;5;114m',
    user: '\x1b[38;5;193m',
    cmd: '\x1b[38;5;120m',
    game: '\x1b[38;5;151m',
    bgSoft: '\x1b[48;5;22m'
  }
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function resolveThemeName() {
  const raw = (process.env.LIVEBOT_THEME || process.env.THEME || 'coral')
    .toLowerCase()
    .trim();
  if (THEMES[raw]) return raw;
  // aliases
  if (['morgana', 'red', 'vermelho', 'default'].includes(raw)) return 'coral';
  if (['abismo', 'purple', 'roxo', 'voids'].includes(raw)) return 'void';
  if (['white', 'ouro', 'gold', 'paleking'].includes(raw)) return 'pale';
  if (['green', 'verde', 'greenpath'].includes(raw)) return 'moss';
  return 'coral';
}

function getTheme() {
  const id = resolveThemeName();
  return { id, ...THEMES[id], reset: RESET, bold: BOLD, dim: DIM };
}

function paint(colorKey, text) {
  const t = getTheme();
  const code = t[colorKey] || t.text;
  return `${code}${text}${RESET}`;
}

function listThemes() {
  return Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name }));
}

module.exports = {
  THEMES,
  getTheme,
  paint,
  listThemes,
  resolveThemeName,
  RESET,
  BOLD,
  DIM
};

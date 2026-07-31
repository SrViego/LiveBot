/**
 * Voz visual do LiveBot no chat Twitch (limite ~500 chars).
 * Hallownest: limpo, quente, com ✦ e emojis consistentes.
 */

const MAX = 480;

const ICONS = {
  brand: '✦',
  game: '🎮',
  list: '📋',
  death: '💀',
  win: '🏆',
  hype: '🔥',
  meta: '🎯',
  title: '📺',
  brb: '⏸',
  live: '▶️',
  obs: '🎬',
  tip: '💡',
  ok: '✅',
  warn: '⚠️',
  chat: '💬',
  clock: '⏱',
  heart: '🕯️',
  star: '⭐',
  next: '➡️',
  prev: '⬅️',
  add: '➕',
  rm: '➖',
  so: '📣',
  lurk: '👁',
  pix: '💰',
  follow: '➕',
  gift: '🎁',
  bits: '💎',
  raid: '📣'
};

function clip(text, max = MAX) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Mensagem com selo do bot */
function say(body, { icon = ICONS.brand } = {}) {
  return clip(`${icon} ${body}`);
}

/** Título curto + corpo */
function card(title, lines = [], { icon = ICONS.brand } = {}) {
  const parts = [`${icon} ${title}`];
  for (const line of lines) {
    if (line != null && String(line).trim() !== '') parts.push(String(line).trim());
  }
  return clip(parts.join(' · '));
}

function joinParts(parts, sep = ' · ') {
  return parts.filter((p) => p != null && String(p).trim() !== '').join(sep);
}

function gameNow(name, note) {
  if (!name) {
    return say('Nenhum jogo definido ainda. Mod: !setjogo Nome', { icon: ICONS.game });
  }
  return card(`Agora: ${name}`, note ? [`${ICONS.tip} ${note}`] : [], { icon: ICONS.game });
}

function playlistLine(items, current, index) {
  if (!items.length) {
    return say('Lista vazia. Mod: !setlista A | B | C', { icon: ICONS.list });
  }
  const bits = items.map((g, i) => {
    const isCur =
      current && g.toLowerCase() === String(current).toLowerCase();
    if (isCur) return `${i + 1}.【${g}】`;
    return `${i + 1}.${g}`;
  });
  return card('Roteiro', [bits.join(' › ')], { icon: ICONS.list });
}

function deathsLine(n, game) {
  const g = game ? ` em ${game}` : '';
  return say(`Mortes${g}: ${n}`, { icon: ICONS.death });
}

function winsLine(n) {
  return say(`Vitórias: ${n}`, { icon: ICONS.win });
}

function hypeLine(n, user) {
  const lines = [
    `Hype ${n}! O hall treme — valeu, ${user}!`,
    `${user} acendeu o fogo · hype ${n}`,
    `Energia no chat: ${n} · ${user} 🔥`
  ];
  return say(lines[Math.floor(Math.random() * lines.length)], { icon: ICONS.hype });
}

function welcome(user, game) {
  const g = game ? ` · jogando ${game}` : '';
  const opts = [
    `Bem-vindo(a), ${user}! O fogo tá aceso${g}. !comandos`,
    `Ei ${user}! Entra no hall${g}. !jogo · !comandos`,
    `${user} chegou em Dirtmouth${g}. Senta no banco 🕯️`
  ];
  return say(opts[Math.floor(Math.random() * opts.length)], { icon: ICONS.heart });
}

function modOnlyHint() {
  return say('Só mod/streamer pode usar esse comando.', { icon: ICONS.warn });
}

function obsNote(base, obsResult) {
  if (!obsResult || obsResult.skipped) return base;
  if (obsResult.ok && obsResult.scene) {
    return clip(`${base} · ${ICONS.obs} ${obsResult.scene}`);
  }
  if (obsResult.ok === false && obsResult.error) {
    return clip(`${base} · ${ICONS.warn} OBS: ${obsResult.error}`);
  }
  return base;
}

function helpPublic(customNames = []) {
  const core =
    '!jogo !jogos !morte !win !stats !meta !hype !lurk !citacao !oi !pix !apoios';
  const filtered = customNames.filter(
    (n) => !['pix', 'donate', 'doar', 'cafe', 'apoio'].includes(String(n).toLowerCase())
  );
  const extra = filtered.length
    ? ` · ${filtered.map((n) => `!${n}`).join(' ')}`
    : '';
  return say(`Comandos: ${core}${extra} · mods: !setjogo !proximo !brb !cena !obrigado`, {
    icon: ICONS.brand
  });
}

function helpMod() {
  return say(
    'Mods: !setjogo !setlista A|B|C !addjogo !proximo !anterior !dica !setmeta !settitulo !brb !voltar !cena !obs !so !reset !morte !obrigado @user [valor]',
    { icon: ICONS.star }
  );
}

function thanksLine(t = {}) {
  const parts = [
    t.follow ? `➕${t.follow}` : null,
    t.sub ? `⭐${t.sub}` : null,
    t.gift ? `🎁${t.gift}` : null,
    t.bits ? `💎${t.bits}` : null,
    t.raid ? `📣${t.raid}` : null,
    t.donation ? `💰${t.donation}` : null
  ].filter(Boolean);
  if (!parts.length) {
    return say('Ainda sem apoios registados nesta sessão. !pix pra chave.', {
      icon: ICONS.heart
    });
  }
  return card('Apoios da sessão', parts, { icon: ICONS.heart });
}

module.exports = {
  ICONS,
  MAX,
  clip,
  say,
  card,
  joinParts,
  gameNow,
  playlistLine,
  deathsLine,
  winsLine,
  hypeLine,
  welcome,
  modOnlyHint,
  obsNote,
  helpPublic,
  helpMod,
  thanksLine
};

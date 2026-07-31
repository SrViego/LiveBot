/**
 * Mensagens de agradecimento (follow, sub, bits, raid, PIX).
 */

const fs = require('node:fs');
const path = require('node:path');
const S = require('./style');

const file = path.join(__dirname, '..', 'data', 'alerts.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw;
  } catch {
    return {
      enabled: {},
      messages: {},
      pixKey: '',
      minBitsToThank: 1,
      donationKeywords: []
    };
  }
}

function pick(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template, vars) {
  let t = template;
  for (const [k, v] of Object.entries(vars)) {
    t = t.replace(new RegExp(`\\{${k}\\}`, 'gi'), v == null ? '' : String(v));
  }
  return t.replace(/\s{2,}/g, ' ').trim();
}

function isEnabled(cfg, key) {
  return cfg.enabled?.[key] !== false;
}

/**
 * @param {string} type
 * @param {Record<string, string|number>} vars
 */
function formatAlert(type, vars = {}) {
  const cfg = load();
  if (!isEnabled(cfg, type)) return null;
  const template = pick(cfg.messages?.[type]);
  if (!template) return null;
  return S.clip(fill(template, vars));
}

function pixInfo() {
  const cfg = load();
  const key = process.env.PIX_KEY?.trim() || cfg.pixKey || '';
  if (!key || key.includes('cole_sua')) {
    return S.say(
      'Ainda não configurei o PIX — edita data/alerts.json (pixKey) ou PIX_KEY no .env',
      { icon: S.ICONS.heart }
    );
  }
  const template = pick(cfg.messages?.pix) || '✦ PIX: {pix}';
  return S.clip(
    fill(template, {
      pix: key,
      label: cfg.pixLabel || 'PIX'
    })
  );
}

/**
 * Detecta no chat se alguém disse que doou (heurística).
 */
function looksLikeDonationMessage(text) {
  const cfg = load();
  const t = (text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const keys = cfg.donationKeywords || [];
  return keys.some((k) => {
    const n = k.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return t.includes(n);
  });
}

function donationThank(user, amount, note) {
  return formatAlert('donation', {
    user,
    amount: amount ? ` (${amount})` : '',
    note: note ? `${note} ` : ''
  });
}

module.exports = {
  load,
  formatAlert,
  pixInfo,
  looksLikeDonationMessage,
  donationThank,
  file
};

/**
 * Backup de state + resumo de sessão.
 */

const fs = require('node:fs');
const path = require('node:path');
const state = require('./state');

const backupDir = path.join(__dirname, '..', 'data', 'backups');

function progressBar(current, target, width = 10) {
  if (!target || target <= 0) return '';
  const ratio = Math.max(0, Math.min(1, current / target));
  const filled = Math.round(ratio * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${Math.round(ratio * 100)}%`;
}

function formatMeta(s = state.get()) {
  const g = s.metaGoal;
  if (g && g.target != null) {
    const cur = Number(g.current) || 0;
    const tgt = Number(g.target) || 0;
    const unit = g.unit ? ` ${g.unit}` : '';
    const label = g.label || s.meta || 'Meta';
    const bar = progressBar(cur, tgt);
    return `${label}: ${cur}/${tgt}${unit} ${bar}`.trim();
  }
  if (s.meta) return `Meta: ${s.meta}`;
  return null;
}

function buildSummary({ startedAt, messagesHandled } = {}) {
  const s = state.get();
  const sec = Math.floor((Date.now() - (startedAt || Date.now())) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const up = [h && `${h}h`, `${m}m`].filter(Boolean).join(' ') || `${sec}s`;
  const t = s.thanks || {};
  const parts = [
    `⏱ ${up}`,
    s.currentGame ? `🎮 ${s.currentGame}` : null,
    `💀${s.counters?.morte || 0}`,
    `🏆${s.counters?.win || 0}`,
    `🔥${s.counters?.hype || 0}`,
    t.follow ? `➕${t.follow}` : null,
    t.sub ? `⭐${t.sub}` : null,
    t.bits ? `💎${t.bits}` : null,
    t.donation ? `💰${t.donation}` : null,
    s.requests?.length ? `📋${s.requests.length} pedidos` : null,
    messagesHandled != null ? `💬${messagesHandled}` : null
  ].filter(Boolean);
  const meta = formatMeta(s);
  if (meta) parts.push(meta);
  return parts.join(' · ');
}

function backupState() {
  try {
    const src = state.file;
    if (!fs.existsSync(src)) return null;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(backupDir, `state-${stamp}.json`);
    fs.copyFileSync(src, dest);
    // keep last 30
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('state-') && f.endsWith('.json'))
      .sort();
    while (files.length > 30) {
      const old = files.shift();
      try {
        fs.unlinkSync(path.join(backupDir, old));
      } catch {
        /* ignore */
      }
    }
    return dest;
  } catch {
    return null;
  }
}

module.exports = {
  backupDir,
  progressBar,
  formatMeta,
  buildSummary,
  backupState
};

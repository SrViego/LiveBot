/**
 * Linha de status no terminal (atualiza periodicamente).
 */

const state = require('./state');
const obs = require('./obs');
const { formatMeta } = require('./session');
const { getTheme } = require('./theme');

let timer = null;
let lastLine = '';

function buildLine({ messagesHandled = 0, startedAt = Date.now() } = {}) {
  const s = state.get();
  const t = s.thanks || {};
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(sec / 60);
  const parts = [
    `⏱${m}m`,
    s.currentGame ? `🎮${s.currentGame}` : '🎮—',
    `💀${s.counters?.morte || 0}`,
    `🏆${s.counters?.win || 0}`,
    t.follow ? `➕${t.follow}` : null,
    t.sub ? `⭐${t.sub}` : null,
    t.donation ? `💰${t.donation}` : null,
    s.requests?.length ? `📋${s.requests.length}` : null,
    `💬${messagesHandled}`,
    obs.isEnabled() ? obs.statusLine().replace(/^OBS:\s*/i, 'OBS ') : null
  ].filter(Boolean);
  const meta = formatMeta(s);
  if (meta) parts.push(meta.slice(0, 40));
  return parts.join(' │ ');
}

function startDashboard(getCtx) {
  if (process.env.DASHBOARD === '0') return { stop() {}, refresh() {} };
  const ms = Number(process.env.DASHBOARD_MS || 15000);

  const paint = () => {
    try {
      const ctx = typeof getCtx === 'function' ? getCtx() : {};
      const line = buildLine(ctx);
      if (line === lastLine) return;
      lastLine = line;
      const th = getTheme();
      // linha compacta sem apagar o scroll inteiro
      process.stdout.write(
        `\r${th.muted}  ▸ ${th.text}${line}${th.reset}                    `
      );
    } catch {
      /* ignore */
    }
  };

  timer = setInterval(paint, ms);
  if (typeof timer.unref === 'function') timer.unref();
  // first paint after a beat
  setTimeout(paint, 2000);

  return {
    refresh: paint,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      process.stdout.write('\n');
    }
  };
}

module.exports = { startDashboard, buildLine };

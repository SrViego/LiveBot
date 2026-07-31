/**
 * Lembrete periódico de clip.
 */

const S = require('./style');

const DEFAULT_LINES = [
  'Marca o momento — usa o botão de CLIP se curtiu essa hora! 🎬',
  'Clip time? Se rolou algo épico, salva com clip 🕯️',
  'Dica do hall: clipa o que merecer voltar no highlight ✨'
];

/**
 * @param {{ say: (msg: string) => Promise<void>, intervalMs?: number, enabled?: boolean }} opts
 */
function startClipReminder({ say, intervalMs, enabled }) {
  if (enabled === false || process.env.CLIP_REMINDER === '0') {
    return { stop() {} };
  }
  const ms = Number(
    intervalMs || process.env.CLIP_REMINDER_MS || 30 * 60 * 1000
  );
  if (!ms || ms < 60_000) {
    return { stop() {} };
  }

  let i = 0;
  const timer = setInterval(() => {
    const custom = (process.env.CLIP_REMINDER_MSG || '').trim();
    const line =
      custom ||
      DEFAULT_LINES[i++ % DEFAULT_LINES.length];
    say(S.say(line, { icon: '🎬' })).catch(() => {});
  }, ms);

  if (typeof timer.unref === 'function') timer.unref();

  return {
    stop() {
      clearInterval(timer);
    }
  };
}

module.exports = { startClipReminder, DEFAULT_LINES };

/**
 * Terminal com tema de cores Hallownest.
 */

const version = require('../package.json').version;
const { getTheme, listThemes, paint } = require('./theme');

function line(ch = '─', n = 48) {
  return ch.repeat(n);
}

function banner({ channel, bot, game, obsLine, prefix }) {
  const t = getTheme();
  const R = t.reset;
  const border = `${t.border}${line('═')}${R}`;
  const soft = `${t.muted}${line('─')}${R}`;

  console.log('');
  console.log(border);
  console.log(
    `${t.brand}  ✦ LiveBot${R}${t.muted}  ·  ${t.name}${R}${t.muted}  ·  v${version}${R}`
  );
  console.log(soft);
  row(t, 'canal', `#${channel}`, 'primary');
  row(t, 'bot', bot, 'text');
  row(t, 'prefixo', prefix, 'accent');
  row(t, 'jogo', game || '— nenhum —', game ? 'game' : 'muted');
  row(t, 'obs', obsLine, 'info');
  row(t, 'tema', `${t.id} (${t.name})`, 'accent');
  console.log(border);
  console.log(
    `${t.muted}  !setlista${R}${t.cmd} A | B | C${R}${t.muted}  ·  !setjogo  ·  !proximo  ·  !comandos${R}`
  );
  console.log(
    `${t.muted}  Temas: LIVEBOT_THEME=${listThemes()
      .map((x) => x.id)
      .join('|')}${R}`
  );
  console.log('');
}

function row(t, label, value, colorKey = 'text') {
  const lab = `${t.muted}${String(label).padEnd(8)}${t.reset}`;
  const code = t[colorKey] || t.text;
  console.log(`  ${lab}${code}${value}${t.reset}`);
}

function ok(msg) {
  const t = getTheme();
  console.log(`${t.success}  ✓${t.reset} ${t.text}${msg}${t.reset}`);
}

function info(msg) {
  const t = getTheme();
  console.log(`${t.info}  ·${t.reset} ${t.muted}${msg}${t.reset}`);
}

function warn(msg) {
  const t = getTheme();
  console.log(`${t.warn}  !${t.reset} ${t.warn}${msg}${t.reset}`);
}

function err(msg) {
  const t = getTheme();
  console.log(`${t.error}  ✗${t.reset} ${t.error}${msg}${t.reset}`);
}

function cmdLog(user, cmd, okFlag = true) {
  const t = getTheme();
  const mark = okFlag ? `${t.success}→${t.reset}` : `${t.muted}·${t.reset}`;
  const time = new Date().toLocaleTimeString();
  console.log(
    `  ${mark} ${t.muted}${time}${t.reset} ${t.user}${user}${t.reset} ${t.cmd}!${cmd}${t.reset}`
  );
}

function themePreview() {
  const t = getTheme();
  console.log(`${t.brand}Tema ativo: ${t.name}${t.reset}`);
  for (const th of listThemes()) {
    const mark = th.id === t.id ? '◀' : ' ';
    console.log(`  ${mark} ${th.id.padEnd(6)} ${th.name}`);
  }
}

module.exports = {
  banner,
  ok,
  info,
  warn,
  err,
  cmdLog,
  themePreview,
  version,
  paint,
  getTheme
};

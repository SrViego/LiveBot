/**
 * Comandos LiveBot — multi-jogo + OBS + voz Hallownest.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pickQuote, pick, DEATH_LINES, WIN_LINES } = require('./flavor');
const state = require('./state');
const obs = require('./obs');
const S = require('./style');
const { listThemes, resolveThemeName } = require('./theme');
const alerts = require('./alerts');
const { bumpThanks } = require('./events-twitch');
const twitchApi = require('./twitch-api');
const { formatMeta } = require('./session');

const commandsFile = path.join(__dirname, '..', 'data', 'commands.json');

function loadCustom() {
  try {
    return JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
  } catch {
    return {};
  }
}

/** @returns {Map<string, { response: string, vip?: boolean, mod?: boolean, name: string }>} */
function buildCustomMap(custom) {
  const map = new Map();
  for (const [name, def] of Object.entries(custom)) {
    if (!def?.response) continue;
    const entry = {
      response: def.response,
      vip: Boolean(def.vip || def.subOnly || def.subscriber),
      mod: Boolean(def.mod || def.modOnly),
      name
    };
    map.set(name.toLowerCase(), entry);
    for (const a of def.aliases || []) {
      map.set(String(a).toLowerCase(), entry);
    }
  }
  return map;
}

function buildAliasMap(custom) {
  const map = new Map();
  for (const [k, v] of buildCustomMap(custom)) {
    map.set(k, v.response);
  }
  return map;
}

function parseMetaArg(arg) {
  // "50/100 reais" | "50 / 100" | "texto livre"
  const m = String(arg)
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?:\s+(.+))?$/);
  if (m) {
    const current = parseFloat(m[1].replace(',', '.'));
    const target = parseFloat(m[2].replace(',', '.'));
    const rest = (m[3] || '').trim();
    // "reais da live" or unit only
    let unit = '';
    let label = 'Meta';
    if (rest) {
      const parts = rest.split(/\s+/);
      if (parts.length === 1) unit = parts[0];
      else {
        unit = parts[0];
        label = rest;
      }
    }
    return { mode: 'goal', current, target, unit, label };
  }
  return { mode: 'text', text: arg.slice(0, 200) };
}

function gameLine(s = state.get()) {
  if (s.brb) {
    return S.say(`BRB — ${s.brbMessage}`, { icon: S.ICONS.brb });
  }
  const note = s.currentGame ? s.gameNotes?.[s.currentGame] : null;
  return S.gameNow(s.currentGame, note);
}

function withObs(text, obsResult) {
  return S.obsNote(text, obsResult);
}

function bumpCounter(key, delta = 1) {
  const s = state.get();
  if (!s.counters) s.counters = {};
  s.counters[key] = Math.max(0, (s.counters[key] || 0) + delta);
  state.persist();
  return s.counters[key];
}

async function handleBuiltin(cmd, ctx) {
  const s = state.get();
  const arg = (ctx.args || []).join(' ').trim();
  const first = (ctx.args[0] || '').trim();
  const sub = first.toLowerCase();

  switch (cmd) {
    case 'comandos':
    case 'commands':
    case 'ajuda':
    case 'help': {
      if (sub === 'mod' || sub === 'mods') {
        return { text: S.helpMod() };
      }
      if (sub === 'tema' || sub === 'theme' || sub === 'temas') {
        const cur = resolveThemeName();
        const list = listThemes()
          .map((th) => (th.id === cur ? `【${th.id}】` : th.id))
          .join(' · ');
        return {
          text: S.say(
            `Tema do terminal: ${cur}. Opções: ${list} · no .env LIVEBOT_THEME=coral|void|pale|moss`,
            { icon: S.ICONS.brand }
          )
        };
      }
      return {
        text: S.helpPublic(Object.keys(loadCustom()))
      };
    }

    case 'tema':
    case 'theme': {
      // chat só informa — cor é no terminal do host
      const cur = resolveThemeName();
      const list = listThemes()
        .map((th) => `${th.id}${th.id === cur ? '◀' : ''}`)
        .join(' · ');
      return {
        text: S.say(
          `Cores do LiveBot (PC): ${list}. Muda com LIVEBOT_THEME= no .env e reinicia.`,
          { icon: '🎨' }
        )
      };
    }

    case 'ping':
      return {
        text: S.say(`Pong, ${ctx.user}! Latência do prego ok.`, { icon: S.ICONS.ok })
      };

    case 'citacao':
    case 'citação':
    case 'quote':
    case 'lore': {
      const q = pickQuote();
      return {
        text: S.say(`${q.t} — “${q.q}”`, { icon: S.ICONS.heart })
      };
    }

    case 'so':
    case 'shoutout': {
      const nick = first.replace(/^@/, '');
      if (!nick) {
        return { text: S.say('Uso: !so <canal>', { icon: S.ICONS.so }), isModOnly: true };
      }
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (twitchApi.isReady()) {
        const info = await twitchApi.getChannelInfo(nick);
        if (info.ok) {
          const game = info.game ? ` · last: ${info.game}` : '';
          const title = info.title ? ` · “${String(info.title).slice(0, 60)}”` : '';
          return {
            text: S.say(
              `Shoutout → twitch.tv/${info.login} (${info.displayName})${game}${title} — visita o hall deles!`,
              { icon: S.ICONS.so }
            ),
            isModOnly: true
          };
        }
        return {
          text: S.say(
            `Shoutout → twitch.tv/${nick.toLowerCase()} — (API: ${info.error || 'falhou'})`,
            { icon: S.ICONS.so }
          ),
          isModOnly: true
        };
      }
      return {
        text: S.say(
          `Shoutout → twitch.tv/${nick.toLowerCase()} — visita o hall deles! (TWITCH_CLIENT_ID p/ jogo)`,
          { icon: S.ICONS.so }
        ),
        isModOnly: true
      };
    }

    case 'uptime': {
      const sec = Math.floor((Date.now() - ctx.startedAt) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s2 = sec % 60;
      const t = [h && `${h}h`, (m || h) && `${m}m`, `${s2}s`].filter(Boolean).join(' ');
      return {
        text: S.card(`Bot online ${t}`, [gameLine(s)], { icon: S.ICONS.clock })
      };
    }

    case 'ola':
    case 'oi':
    case 'olá':
    case 'hello':
    case 'hey':
      return { text: S.welcome(ctx.user, s.currentGame) };

    // ── multi-jogo ─────────────────────────────────────────
    case 'jogo':
    case 'game':
    case 'jogando':
    case 'playing':
      return { text: gameLine(s) };

    case 'setjogo':
    case 'setgame':
    case 'jogonow': {
      if (!arg) {
        return {
          text: S.say('Uso: !setjogo Nome do jogo', { icon: S.ICONS.game }),
          isModOnly: true
        };
      }
      state.setGame(arg);
      const note = state.get().gameNotes?.[arg];
      const obsRes = await obs.onGameChange(arg);
      return {
        text: withObs(
          S.card(`Trocou de jogo → ${arg}`, note ? [`${S.ICONS.tip} ${note}`] : [], {
            icon: S.ICONS.game
          }),
          obsRes
        ),
        isModOnly: true
      };
    }

    case 'jogos':
    case 'playlist':
    case 'lista':
    case 'roteiro':
      return {
        text: S.playlistLine(s.playlist || [], s.currentGame, s.playlistIndex || 0)
      };

    case 'addjogo':
    case 'addgame': {
      if (!arg) {
        return { text: S.say('Uso: !addjogo Nome', { icon: S.ICONS.add }), isModOnly: true };
      }
      if (!s.playlist) s.playlist = [];
      if (s.playlist.some((g) => g.toLowerCase() === arg.toLowerCase())) {
        return {
          text: S.say(`“${arg}” já está no roteiro.`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      s.playlist.push(arg.slice(0, 80));
      state.persist();
      return {
        text: S.say(`Adicionado: ${arg} · ${S.playlistLine(s.playlist, s.currentGame, s.playlistIndex)}`, {
          icon: S.ICONS.add
        }),
        isModOnly: true
      };
    }

    case 'rmjogo':
    case 'deljogo':
    case 'remjogo': {
      if (!arg) {
        return {
          text: S.say('Uso: !rmjogo Nome ou número', { icon: S.ICONS.rm }),
          isModOnly: true
        };
      }
      const n = parseInt(arg, 10);
      if (Number.isInteger(n) && n >= 1 && n <= s.playlist.length) {
        const removed = s.playlist.splice(n - 1, 1)[0];
        state.persist();
        return {
          text: S.say(`Removeu: ${removed}`, { icon: S.ICONS.rm }),
          isModOnly: true
        };
      }
      const before = s.playlist.length;
      s.playlist = s.playlist.filter((g) => g.toLowerCase() !== arg.toLowerCase());
      if (s.playlist.length === before) {
        return {
          text: S.say('Não achei esse jogo na lista.', { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      state.persist();
      return {
        text: S.say(`Removeu: ${arg}`, { icon: S.ICONS.rm }),
        isModOnly: true
      };
    }

    case 'setlista':
    case 'setplaylist': {
      if (!arg) {
        return {
          text: S.say('Uso: !setlista Jogo1 | Jogo2 | Jogo3', { icon: S.ICONS.list }),
          isModOnly: true
        };
      }
      s.playlist = arg
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);
      s.playlistIndex = 0;
      if (s.playlist[0] && !s.currentGame) state.setGame(s.playlist[0]);
      state.persist();
      return {
        text: S.playlistLine(s.playlist, s.currentGame, s.playlistIndex),
        isModOnly: true
      };
    }

    case 'proximo':
    case 'próximo':
    case 'next':
    case 'nextgame': {
      if (!s.playlist.length) {
        return {
          text: S.say('Lista vazia. !setlista A | B | C', { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      if (s.playlistIndex >= s.playlist.length - 1) {
        return {
          text: S.say(
            `Último da lista: ${s.playlist[s.playlistIndex]}. !addjogo pra continuar.`,
            { icon: S.ICONS.list }
          ),
          isModOnly: true
        };
      }
      s.playlistIndex = (s.playlistIndex || 0) + 1;
      const next = s.playlist[s.playlistIndex];
      const keepMortes = sub === 'keep';
      state.setGame(next);
      if (!keepMortes) {
        state.get().counters.morte = 0;
        state.persist();
      }
      const obsRes = await obs.onGameChange(next);
      return {
        text: withObs(
          S.card(`Próximo: ${next}`, [keepMortes ? null : 'Mortes zeradas', 'Chat: !jogo'], {
            icon: S.ICONS.next
          }),
          obsRes
        ),
        isModOnly: true
      };
    }

    case 'anterior':
    case 'prev':
    case 'prevgame': {
      if (!s.playlist.length) {
        return { text: S.say('Lista vazia.', { icon: S.ICONS.warn }), isModOnly: true };
      }
      s.playlistIndex = Math.max(0, (s.playlistIndex || 0) - 1);
      const g = s.playlist[s.playlistIndex];
      state.setGame(g);
      const obsRes = await obs.onGameChange(g);
      return {
        text: withObs(S.say(`Voltou pra: ${g}`, { icon: S.ICONS.prev }), obsRes),
        isModOnly: true
      };
    }

    case 'dica':
    case 'note':
    case 'setdica': {
      if (!arg && cmd !== 'setdica') {
        if (!s.currentGame) {
          return { text: S.say('Sem jogo atual. !setjogo …', { icon: S.ICONS.warn }) };
        }
        const n = s.gameNotes?.[s.currentGame];
        return {
          text: n
            ? S.say(`${s.currentGame}: ${n}`, { icon: S.ICONS.tip })
            : S.say(`Sem dica pra ${s.currentGame}. Mod: !dica <texto>`, {
                icon: S.ICONS.tip
              })
        };
      }
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (cmd === 'setdica' || arg.includes('|')) {
        const [game, ...rest] = arg.split('|').map((x) => x.trim());
        const note = rest.join('|').trim();
        if (!game || !note) {
          return {
            text: S.say('Uso: !setdica Nome | texto', { icon: S.ICONS.tip }),
            isModOnly: true
          };
        }
        if (!s.gameNotes) s.gameNotes = {};
        s.gameNotes[game] = note.slice(0, 200);
        state.persist();
        return {
          text: S.say(`Dica salva pra ${game}.`, { icon: S.ICONS.ok }),
          isModOnly: true
        };
      }
      if (!s.currentGame) {
        return {
          text: S.say('Define o jogo: !setjogo Nome', { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      if (!s.gameNotes) s.gameNotes = {};
      s.gameNotes[s.currentGame] = arg.slice(0, 200);
      state.persist();
      return {
        text: S.say(`${s.currentGame}: ${s.gameNotes[s.currentGame]}`, {
          icon: S.ICONS.tip
        }),
        isModOnly: true
      };
    }

    // ── OBS ────────────────────────────────────────────────
    case 'obs':
    case 'obsstatus': {
      if (sub === 'cenas' || sub === 'scenes') {
        if (!ctx.mod) return { text: obs.statusLine() };
        const scenes = await obs.listScenes();
        if (!scenes.length) {
          return {
            text: S.say(`${obs.statusLine()} · sem cenas`, { icon: S.ICONS.obs }),
            isModOnly: true
          };
        }
        return {
          text: S.clip(
            S.say(`Cenas: ${scenes.slice(0, 12).join(' │ ')}`, { icon: S.ICONS.obs })
          ),
          isModOnly: true
        };
      }
      const cur = await obs.getCurrentScene();
      return {
        text: S.say(
          `${obs.statusLine()}${cur ? ` · cena “${cur}”` : ''}`,
          { icon: S.ICONS.obs }
        )
      };
    }

    case 'cena':
    case 'scene': {
      if (!arg) {
        const cur = await obs.getCurrentScene();
        return {
          text: S.say(
            cur ? `Cena: ${cur} · !cena Nome pra trocar` : 'OBS offline. !obs',
            { icon: S.ICONS.obs }
          ),
          isModOnly: true
        };
      }
      const res = await obs.setScene(arg);
      if (!res.ok) {
        return {
          text: S.say(`Não troquei pra “${arg}” — ${res.error}`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      return {
        text: S.say(`Cena → ${res.scene}`, { icon: S.ICONS.obs }),
        isModOnly: true
      };
    }

    // ── contadores ─────────────────────────────────────────
    case 'morte':
    case 'mortes':
    case 'death':
    case 'deaths': {
      const gameBit = s.currentGame ? ` · ${s.currentGame}` : '';
      if (sub === 'reset' || sub === 'zera') {
        if (!ctx.mod) return { text: null, isModOnly: true };
        s.counters.morte = 0;
        state.persist();
        return {
          text: S.say('Mortes zeradas. Banco limpo.', { icon: S.ICONS.death }),
          isModOnly: true
        };
      }
      if (ctx.mod) {
        if (ctx.args.length === 0 || sub === '+' || sub === '++' || sub === 'add') {
          const v = bumpCounter('morte', 1);
          return {
            text: S.say(
              `Morte! Total ${v}${gameBit} — ${pick(DEATH_LINES)}`,
              { icon: S.ICONS.death }
            )
          };
        }
        if (/^\d+$/.test(first)) {
          const v = bumpCounter('morte', Math.min(50, parseInt(first, 10)));
          return {
            text: S.say(`+${first} → ${v}${gameBit}`, { icon: S.ICONS.death })
          };
        }
      }
      return {
        text: S.deathsLine(s.counters?.morte || 0, s.currentGame)
      };
    }

    case 'win':
    case 'wins':
    case 'vitoria':
    case 'vitória': {
      if (sub === 'reset') {
        if (!ctx.mod) return { text: null, isModOnly: true };
        s.counters.win = 0;
        state.persist();
        return {
          text: S.say('Wins zerados.', { icon: S.ICONS.win }),
          isModOnly: true
        };
      }
      if (ctx.mod && (ctx.args.length === 0 || sub === '+' || sub === '++')) {
        const v = bumpCounter('win', 1);
        return {
          text: S.say(`Win! Total ${v} — ${pick(WIN_LINES)}`, { icon: S.ICONS.win })
        };
      }
      return { text: S.winsLine(s.counters?.win || 0) };
    }

    case 'hype':
    case 'hypetrain': {
      const v = bumpCounter('hype', 1);
      return { text: S.hypeLine(v, ctx.user) };
    }

    case 'reset':
    case 'resetcontadores': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      const what = sub || 'all';
      if (what === 'morte' || what === 'mortes') s.counters.morte = 0;
      else if (what === 'win' || what === 'wins') s.counters.win = 0;
      else if (what === 'hype') s.counters.hype = 0;
      else s.counters = { morte: 0, win: 0, hype: 0 };
      state.persist();
      return {
        text: S.say(`Contadores resetados (${what === 'all' || !first ? 'tudo' : what}).`, {
          icon: S.ICONS.ok
        }),
        isModOnly: true
      };
    }

    case 'stats':
    case 'contadores': {
      const t = s.thanks || {};
      const thankBits = [
        t.follow ? `➕${t.follow}` : null,
        t.sub ? `⭐${t.sub}` : null,
        t.bits ? `💎${t.bits}` : null,
        t.donation ? `💰${t.donation}` : null
      ].filter(Boolean);
      return {
        text: S.card(
          'Sessão',
          [
            `💀 ${s.counters?.morte || 0}`,
            `🏆 ${s.counters?.win || 0}`,
            `🔥 ${s.counters?.hype || 0}`,
            s.currentGame ? `🎮 ${s.currentGame}` : null,
            thankBits.length ? thankBits.join(' ') : null
          ],
          { icon: S.ICONS.star }
        )
      };
    }

    case 'meta':
    case 'goal':
      return { text: S.metaLine(s) };

    case 'setmeta': {
      if (!arg) {
        return {
          text: S.say(
            'Uso: !setmeta 50/100 reais  ·  !setmeta 3/5 bosses  ·  !setmeta texto livre',
            { icon: S.ICONS.meta }
          ),
          isModOnly: true
        };
      }
      const parsed = parseMetaArg(arg);
      if (parsed.mode === 'goal') {
        s.metaGoal = {
          label: parsed.label || 'Meta',
          current: parsed.current,
          target: parsed.target,
          unit: parsed.unit || ''
        };
        s.meta = formatMeta(s) || arg.slice(0, 200);
      } else {
        s.metaGoal = null;
        s.meta = parsed.text;
      }
      state.persist();
      return { text: S.metaLine(s), isModOnly: true };
    }

    case 'meta+':
    case 'metaadd':
    case 'addmeta': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (!s.metaGoal?.target) {
        return {
          text: S.say('Define progresso: !setmeta 0/100 reais', { icon: S.ICONS.meta }),
          isModOnly: true
        };
      }
      const delta = parseFloat(String(first || '1').replace(',', '.'));
      if (Number.isNaN(delta)) {
        return {
          text: S.say('Uso: !meta+ 10', { icon: S.ICONS.meta }),
          isModOnly: true
        };
      }
      s.metaGoal.current = (Number(s.metaGoal.current) || 0) + delta;
      s.meta = formatMeta(s);
      state.persist();
      return { text: S.metaLine(s), isModOnly: true };
    }

    case 'meta-':
    case 'metasub': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (!s.metaGoal?.target) {
        return {
          text: S.say('Sem meta com número.', { icon: S.ICONS.meta }),
          isModOnly: true
        };
      }
      const delta = parseFloat(String(first || '1').replace(',', '.'));
      if (Number.isNaN(delta)) {
        return { text: S.say('Uso: !meta- 5', { icon: S.ICONS.meta }), isModOnly: true };
      }
      s.metaGoal.current = Math.max(0, (Number(s.metaGoal.current) || 0) - delta);
      s.meta = formatMeta(s);
      state.persist();
      return { text: S.metaLine(s), isModOnly: true };
    }

    case 'titulo':
    case 'title':
      return {
        text: s.title
          ? S.say(`Live: ${s.title}`, { icon: S.ICONS.title })
          : S.say('Sem título extra. Mod: !settitulo …', { icon: S.ICONS.title })
      };

    case 'settitulo':
    case 'settitle': {
      if (!arg) {
        return {
          text: S.say('Uso: !settitulo tema da live', { icon: S.ICONS.title }),
          isModOnly: true
        };
      }
      s.title = arg.slice(0, 150);
      state.persist();
      return {
        text: S.say(`Título: ${s.title}`, { icon: S.ICONS.title }),
        isModOnly: true
      };
    }

    case 'brb': {
      if (ctx.mod) {
        s.brb = true;
        if (arg) s.brbMessage = arg.slice(0, 120);
        state.persist();
        const obsRes = await obs.onBrb();
        return {
          text: withObs(
            S.say(`BRB — ${s.brbMessage}`, { icon: S.ICONS.brb }),
            obsRes
          ),
          isModOnly: true
        };
      }
      return {
        text: s.brb
          ? S.say(`Streamer em BRB: ${s.brbMessage}`, { icon: S.ICONS.brb })
          : S.say('Streamer no hall (sem BRB).', { icon: S.ICONS.live })
      };
    }

    case 'voltar':
    case 'back':
    case 'voltei': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      s.brb = false;
      state.persist();
      const obsRes = await obs.onBack();
      if (s.currentGame) await obs.onGameChange(s.currentGame);
      return {
        text: withObs(S.say(`Voltei! ${gameLine(s)}`, { icon: S.ICONS.live }), obsRes),
        isModOnly: true
      };
    }

    case 'lurk':
    case 'lurkando':
      return {
        text: S.say(
          pick([
            `${ctx.user} em lurk. Bom descanso no banco do hall.`,
            `Lurk de ${ctx.user} · o Stag espera quieto.`
          ]),
          { icon: S.ICONS.lurk }
        )
      };

    // ── PIX / doações / apoios ─────────────────────────────
    case 'pix':
    case 'doar':
    case 'donate':
    case 'cafe':
    case 'café':
    case 'apoio':
      return { text: alerts.pixInfo() };

    case 'apoios':
    case 'thanks':
    case 'obrigados':
      return { text: S.thanksLine(s.thanks || {}) };

    case 'obrigado':
    case 'agradecimento':
    case 'thx': {
      // mod: !obrigado @user [valor] [nota…]
      if (!ctx.mod) return { text: null, isModOnly: true };
      const nick = first.replace(/^@/, '');
      if (!nick) {
        return {
          text: S.say('Uso: !obrigado @user [valor] [nota]', { icon: S.ICONS.pix }),
          isModOnly: true
        };
      }
      const rest = (ctx.args || []).slice(1);
      let amount = '';
      let note = '';
      if (rest.length) {
        const maybeAmt = rest[0];
        if (/^r\$?\s*\d/i.test(maybeAmt) || /^\d+([.,]\d+)?(rs?|reais?)?$/i.test(maybeAmt)) {
          amount = maybeAmt;
          note = rest.slice(1).join(' ').trim();
        } else {
          note = rest.join(' ').trim();
        }
      }
      bumpThanks('donation');
      if (amount && s.metaGoal?.target != null) {
        const n = parseFloat(String(amount).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!Number.isNaN(n)) {
          s.metaGoal.current = (Number(s.metaGoal.current) || 0) + n;
          s.meta = formatMeta(s);
          state.persist();
        }
      }
      const text =
        alerts.donationThank(nick, amount, note) ||
        S.say(`Obrigado pela doação, ${nick}${amount ? ` (${amount})` : ''}! 🕯️`, {
          icon: S.ICONS.pix
        });
      return { text, isModOnly: true };
    }

    // ── pedidos ────────────────────────────────────────────
    case 'pedido':
    case 'request':
    case 'sugestao':
    case 'sugestão': {
      if (!s.requests) s.requests = [];
      // mod shortcuts: !pedido next | skip | clear
      if (ctx.mod && ['next', 'proximo', 'próximo', 'skip', 'clear', 'limpar', 'lista'].includes(sub)) {
        if (sub === 'lista') {
          /* fall through to list via pedidos */
        } else if (sub === 'clear' || sub === 'limpar') {
          s.requests = [];
          state.persist();
          return {
            text: S.say('Fila de pedidos limpa.', { icon: S.ICONS.ok }),
            isModOnly: true
          };
        } else if (sub === 'skip') {
          const skipped = s.requests.shift();
          state.persist();
          return {
            text: skipped
              ? S.say(`Pulou: ${skipped.user} — ${skipped.text}`, { icon: S.ICONS.rm })
              : S.say('Fila vazia.', { icon: S.ICONS.warn }),
            isModOnly: true
          };
        } else {
          // next
          const item = s.requests.shift();
          state.persist();
          if (!item) {
            return {
              text: S.say('Fila vazia. Chat: !pedido …', { icon: S.ICONS.list }),
              isModOnly: true
            };
          }
          const left = s.requests.length;
          return {
            text: S.say(
              `Próximo pedido: ${item.user} — ${item.text}${left ? ` · restam ${left}` : ' · fila vazia'}`,
              { icon: S.ICONS.next }
            ),
            isModOnly: true
          };
        }
      }
      const text = arg || '';
      if (!text || ['next', 'proximo', 'próximo', 'skip', 'clear', 'limpar', 'lista'].includes(sub)) {
        return {
          text: S.say('Uso: !pedido quero ver X  ·  mods: !pedido next|skip|clear', {
            icon: S.ICONS.list
          })
        };
      }
      if (s.requests.length >= 30) {
        return {
          text: S.say('Fila cheia (30). Espera um pouco.', { icon: S.ICONS.warn })
        };
      }
      // 1 pedido por user na fila
      if (s.requests.some((r) => r.user.toLowerCase() === ctx.user.toLowerCase())) {
        return {
          text: S.say(`${ctx.user}, já tens um pedido na fila. !pedidos`, {
            icon: S.ICONS.warn
          })
        };
      }
      s.requests.push({
        user: ctx.user,
        text: text.slice(0, 120),
        at: Date.now()
      });
      state.persist();
      return {
        text: S.say(
          `Pedido #${s.requests.length} de ${ctx.user}: ${text.slice(0, 80)}`,
          { icon: S.ICONS.add }
        )
      };
    }

    case 'pedidos':
    case 'requests':
    case 'fila': {
      if (!s.requests?.length) {
        return {
          text: S.say('Fila vazia. Manda !pedido o que queres ver.', {
            icon: S.ICONS.list
          })
        };
      }
      const shown = s.requests
        .slice(0, 5)
        .map((r, i) => `${i + 1}.${r.user}:${r.text.slice(0, 30)}`)
        .join(' · ');
      const more =
        s.requests.length > 5 ? ` · +${s.requests.length - 5}` : '';
      return {
        text: S.clip(S.say(`Pedidos (${s.requests.length}): ${shown}${more}`, {
          icon: S.ICONS.list
        }))
      };
    }

    case 'proximopedido':
    case 'próximopedido':
    case 'nextpedido': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      return handleBuiltin('pedido', { ...ctx, args: ['next'] });
    }

    // ── Twitch Poll / Prediction API ───────────────────────
    case 'poll':
    case 'enquete': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (sub === 'end' || sub === 'fim' || sub === 'close') {
        if (!twitchApi.isReady()) {
          return {
            text: S.say('Precisa TWITCH_CLIENT_ID + scopes channel:manage:polls', {
              icon: S.ICONS.warn
            }),
            isModOnly: true
          };
        }
        const r = await twitchApi.endPoll('TERMINATED');
        return {
          text: r.ok
            ? S.say('Poll encerrada.', { icon: S.ICONS.ok })
            : S.say(`Poll: ${r.error}`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      // !poll Título | A | B | C  [duração]
      const bits = arg.split('|').map((x) => x.trim()).filter(Boolean);
      if (bits.length < 3) {
        return {
          text: S.say(
            'Uso: !poll Pergunta | Opção1 | Opção2 [| Op3]  ·  !poll end',
            { icon: S.ICONS.star }
          ),
          isModOnly: true
        };
      }
      if (!twitchApi.isReady()) {
        return {
          text: S.say(
            'Poll API: TWITCH_CLIENT_ID + token com channel:manage:polls (bot/streamer)',
            { icon: S.ICONS.warn }
          ),
          isModOnly: true
        };
      }
      const title = bits[0];
      const choices = bits.slice(1);
      // duration se última opção for só número
      let duration = Number(process.env.POLL_DURATION_SEC || 60);
      const last = choices[choices.length - 1];
      if (/^\d+$/.test(last) && choices.length > 2) {
        duration = parseInt(choices.pop(), 10);
      }
      const r = await twitchApi.createPoll(title, choices, duration);
      if (!r.ok) {
        return {
          text: S.say(`Poll falhou: ${r.error}`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      return {
        text: S.say(
          `Poll aberta (${duration}s): ${title} · ${choices.join(' / ')} — vota no painel da Twitch!`,
          { icon: S.ICONS.star }
        ),
        isModOnly: true
      };
    }

    case 'pred':
    case 'prediction':
    case 'aposta': {
      if (!ctx.mod) return { text: null, isModOnly: true };
      if (sub === 'end' || sub === 'cancel' || sub === 'cancela') {
        if (!twitchApi.isReady()) {
          return {
            text: S.say('Precisa channel:manage:predictions', { icon: S.ICONS.warn }),
            isModOnly: true
          };
        }
        const r = await twitchApi.endPrediction('CANCELED');
        return {
          text: r.ok
            ? S.say('Prediction cancelada.', { icon: S.ICONS.ok })
            : S.say(`Pred: ${r.error}`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      const bits = arg.split('|').map((x) => x.trim()).filter(Boolean);
      if (bits.length < 3) {
        return {
          text: S.say(
            'Uso: !pred Título | Outcome1 | Outcome2  ·  !pred end',
            { icon: S.ICONS.star }
          ),
          isModOnly: true
        };
      }
      if (!twitchApi.isReady()) {
        return {
          text: S.say(
            'Pred API: TWITCH_CLIENT_ID + channel:manage:predictions',
            { icon: S.ICONS.warn }
          ),
          isModOnly: true
        };
      }
      const title = bits[0];
      const outcomes = bits.slice(1);
      let windowSec = Number(process.env.PRED_DURATION_SEC || 60);
      const last = outcomes[outcomes.length - 1];
      if (/^\d+$/.test(last) && outcomes.length > 2) {
        windowSec = parseInt(outcomes.pop(), 10);
      }
      const r = await twitchApi.createPrediction(title, outcomes, windowSec);
      if (!r.ok) {
        return {
          text: S.say(`Prediction falhou: ${r.error}`, { icon: S.ICONS.warn }),
          isModOnly: true
        };
      }
      return {
        text: S.say(
          `Prediction (${windowSec}s): ${title} · ${outcomes.join(' / ')} — usa os pontos do canal!`,
          { icon: S.ICONS.star }
        ),
        isModOnly: true
      };
    }

    default:
      return { text: null };
  }
}

async function resolveCommand(name, ctx) {
  const cmd = name.toLowerCase();
  const built = await handleBuiltin(cmd, ctx);
  if (built.text != null || built.isModOnly || built.isVipOnly) return built;

  const map = buildCustomMap(loadCustom());
  const entry = map.get(cmd);
  if (entry) {
    if (entry.mod && !ctx.mod) return { text: null, isModOnly: true };
    if (entry.vip && !ctx.mod && !ctx.vip) {
      return {
        text: S.say('Esse comando é pra sub/VIP.', { icon: S.ICONS.warn }),
        isVipOnly: true
      };
    }
    const s = state.get();
    const text = entry.response
      .replace(/\{user\}/gi, ctx.user)
      .replace(/\{jogo\}/gi, s.currentGame || 'jogo surpresa')
      .replace(/\{game\}/gi, s.currentGame || 'jogo surpresa')
      .replace(/\{meta\}/gi, s.meta || formatMeta(s) || '—')
      .replace(/\{mortes\}/gi, String(s.counters?.morte || 0));
    return { text: S.clip(S.say(text, { icon: S.ICONS.brand })), isVipOnly: entry.vip };
  }

  return { text: null };
}

module.exports = {
  resolveCommand,
  loadCustom,
  buildCustomMap,
  commandsFile,
  gameLine,
  parseMetaArg
};

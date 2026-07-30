/**
 * Integração opcional com OBS Studio (obs-websocket 5.x).
 *
 * No OBS: Ferramentas → WebSocket Server Settings → Enable
 * .env: OBS_ENABLED=1  OBS_URL=ws://127.0.0.1:4455  OBS_PASSWORD=...
 */

const fs = require('node:fs');
const path = require('node:path');

let OBSWebSocket;
try {
  OBSWebSocket = require('obs-websocket-js').default || require('obs-websocket-js');
} catch {
  OBSWebSocket = null;
}

const scenesFile = path.join(__dirname, '..', 'data', 'obs-scenes.json');

/** @type {import('obs-websocket-js').default | null} */
let obs = null;
let connected = false;
let connecting = null;

function loadSceneMap() {
  try {
    if (!fs.existsSync(scenesFile)) {
      return {
        /** cena quando !brb */
        brb: 'BRB',
        /** cena ao !voltar (ou null = anterior) */
        live: 'Live',
        /** "nome do jogo" (minúsculo) → nome exato da cena no OBS */
        games: {
          // "hades": "Hades",
          // "hollow knight": "Hollow Knight"
        },
        /** source de texto no OBS pra mostrar o jogo (opcional) */
        gameTextSource: null
      };
    }
    return JSON.parse(fs.readFileSync(scenesFile, 'utf8'));
  } catch {
    return { brb: 'BRB', live: 'Live', games: {}, gameTextSource: null };
  }
}

function isEnabled() {
  return (
    process.env.OBS_ENABLED === '1' ||
    process.env.OBS_ENABLED === 'true' ||
    Boolean(process.env.OBS_URL && process.env.OBS_PASSWORD !== undefined)
  );
}

function getConfig() {
  return {
    url: process.env.OBS_URL || 'ws://127.0.0.1:4455',
    password: process.env.OBS_PASSWORD || ''
  };
}

async function connect() {
  if (!isEnabled()) {
    console.log('[obs] desligado (OBS_ENABLED=1 no .env para ativar)');
    return false;
  }
  if (!OBSWebSocket) {
    console.warn('[obs] pacote obs-websocket-js em falta — npm install');
    return false;
  }
  if (connected && obs) return true;
  if (connecting) return connecting;

  connecting = (async () => {
    obs = new OBSWebSocket();
    const { url, password } = getConfig();
    try {
      await obs.connect(url, password || undefined);
      connected = true;
      console.log(`[obs] conectado em ${url}`);

      obs.on('ConnectionClosed', () => {
        connected = false;
        console.warn('[obs] conexão fechada');
      });
      obs.on('ConnectionError', (err) => {
        connected = false;
        console.warn('[obs] erro:', err?.message || err);
      });
      return true;
    } catch (err) {
      connected = false;
      obs = null;
      console.error('[obs] falha ao conectar:', err.message);
      console.error('[obs] Confere: OBS aberto · WebSocket ON · porta/senha no .env');
      return false;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

async function ensure() {
  if (!isEnabled()) return false;
  if (connected) return true;
  return connect();
}

async function listScenes() {
  if (!(await ensure())) return [];
  const { scenes } = await obs.call('GetSceneList');
  return (scenes || []).map((s) => s.sceneName);
}

async function getCurrentScene() {
  if (!(await ensure())) return null;
  const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
  return currentProgramSceneName;
}

async function setScene(sceneName) {
  if (!sceneName) return { ok: false, error: 'cena vazia' };
  if (!(await ensure())) return { ok: false, error: 'OBS offline' };
  try {
    await obs.call('SetCurrentProgramScene', { sceneName });
    return { ok: true, scene: sceneName };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Atualiza texto de uma source GDI+/Text se configurada.
 */
async function setGameText(text) {
  const map = loadSceneMap();
  const source = map.gameTextSource || process.env.OBS_GAME_TEXT_SOURCE;
  if (!source) return { ok: true, skipped: true };
  if (!(await ensure())) return { ok: false, error: 'OBS offline' };
  try {
    await obs.call('SetInputSettings', {
      inputName: source,
      inputSettings: { text: String(text || '') },
      overlay: true
    });
    return { ok: true };
  } catch (err) {
    // tenta API alternativa de campos
    try {
      await obs.call('SetInputSettings', {
        inputName: source,
        inputSettings: { text: String(text || '') }
      });
      return { ok: true };
    } catch (err2) {
      return { ok: false, error: err2.message || err.message };
    }
  }
}

/**
 * Resolve cena pelo nome do jogo (mapa em obs-scenes.json).
 */
function sceneForGame(gameName) {
  if (!gameName) return null;
  const map = loadSceneMap();
  const games = map.games || {};
  const key = gameName.toLowerCase().trim();
  if (games[key]) return games[key];
  // match parcial
  for (const [k, scene] of Object.entries(games)) {
    if (key.includes(k) || k.includes(key)) return scene;
  }
  // se existir cena com o mesmo nome do jogo
  return null;
}

async function onGameChange(gameName) {
  if (!isEnabled()) return { ok: true, skipped: true };
  const results = [];
  const scene = sceneForGame(gameName);
  if (scene) {
    results.push(await setScene(scene));
  }
  results.push(await setGameText(gameName || ''));
  const fail = results.find((r) => r && r.ok === false);
  if (fail) return fail;
  return {
    ok: true,
    scene: scene || (await getCurrentScene()),
    textUpdated: Boolean(loadSceneMap().gameTextSource || process.env.OBS_GAME_TEXT_SOURCE)
  };
}

async function onBrb() {
  if (!isEnabled()) return { ok: true, skipped: true };
  const map = loadSceneMap();
  const scene = map.brb || process.env.OBS_SCENE_BRB || 'BRB';
  return setScene(scene);
}

async function onBack() {
  if (!isEnabled()) return { ok: true, skipped: true };
  const map = loadSceneMap();
  const scene = map.live || process.env.OBS_SCENE_LIVE || 'Live';
  return setScene(scene);
}

function statusLine() {
  if (!isEnabled()) return 'OBS: desligado (.env OBS_ENABLED=1)';
  return connected ? `OBS: conectado (${getConfig().url})` : 'OBS: configurado mas offline';
}

module.exports = {
  isEnabled,
  connect,
  ensure,
  listScenes,
  getCurrentScene,
  setScene,
  setGameText,
  sceneForGame,
  onGameChange,
  onBrb,
  onBack,
  statusLine,
  loadSceneMap,
  scenesFile
};

/**
 * Webhook HTTP para doações (LivePix e genéricos).
 * LIVEPIX_WEBHOOK_PORT=8787  (0 = desligado)
 */

const http = require('node:http');
const ui = require('./console-ui');
const alerts = require('./alerts');
const { bumpThanks } = require('./events-twitch');
const state = require('./state');
const { formatMeta } = require('./session');

function pickField(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
    // nested data
    if (obj.data && obj.data[k] != null) return obj.data[k];
    if (obj.payload && obj.payload[k] != null) return obj.payload[k];
  }
  return null;
}

function parseDonation(body) {
  let data = body;
  if (typeof body === 'string') {
    try {
      data = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const user =
    pickField(data, [
      'username',
      'user',
      'from',
      'donor',
      'nickname',
      'name',
      'sender'
    ]) || 'alguém';
  let amount = pickField(data, [
    'amount',
    'value',
    'valor',
    'total',
    'gross'
  ]);
  if (amount != null && typeof amount === 'number') {
    amount = amount >= 100 && Number.isInteger(amount) ? (amount / 100).toFixed(2) : String(amount);
  } else if (amount != null) {
    amount = String(amount);
  }
  const note =
    pickField(data, ['message', 'msg', 'comment', 'note', 'texto']) || '';
  return { user: String(user).slice(0, 40), amount, note: String(note).slice(0, 120) };
}

/**
 * @param {{ say: (m: string) => Promise<void> }} opts
 */
function startLivePixWebhook({ say }) {
  const port = Number(process.env.LIVEPIX_WEBHOOK_PORT || 0);
  if (!port) {
    return { stop() {}, port: 0 };
  }

  const secret = (process.env.LIVEPIX_WEBHOOK_SECRET || '').trim();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('livebot ok');
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (secret) {
      const h =
        req.headers['x-livebot-secret'] ||
        req.headers['x-webhook-secret'] ||
        '';
      if (h !== secret) {
        res.writeHead(401);
        res.end('unauthorized');
        return;
      }
    }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    const donation = parseDonation(raw);
    if (!donation) {
      res.writeHead(400);
      res.end('bad payload');
      return;
    }

    bumpThanks('donation');
    // opcional: somar na meta se unit for reais
    const s = state.get();
    if (s.metaGoal?.target != null && donation.amount) {
      const n = parseFloat(String(donation.amount).replace(',', '.'));
      if (!Number.isNaN(n)) {
        s.metaGoal.current = (Number(s.metaGoal.current) || 0) + n;
        state.persist();
      }
    }

    const text =
      alerts.donationThank(donation.user, donation.amount, donation.note) ||
      null;
    if (text) {
      await say(text).catch(() => {});
      ui.ok(
        `webhook doação · ${donation.user}${donation.amount ? ` ${donation.amount}` : ''}`
      );
      const metaLine = formatMeta();
      if (metaLine && process.env.LIVEPIX_ANNOUNCE_META === '1') {
        await say(metaLine).catch(() => {});
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  server.listen(port, '127.0.0.1', () => {
    ui.ok(`Webhook doações em http://127.0.0.1:${port}/ (POST)`);
  });
  server.on('error', (err) => {
    ui.warn(`Webhook LivePix: ${err.message}`);
  });

  return {
    port,
    stop() {
      server.close();
    }
  };
}

module.exports = { startLivePixWebhook, parseDonation };

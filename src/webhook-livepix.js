/**
 * Webhook HTTP para doações (LivePix e genéricos).
 * LIVEPIX_WEBHOOK_PORT=8787  (0 = desligado)
 */

const http = require('node:http');
const crypto = require('node:crypto');
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
  // Valores são tratados como REAIS (ex.: 25.5 = R$ 25,50).
  // Só converte de centavos quando o campo deixa isso explícito (amountCents, amount_cents…).
  let amount = null;
  const cents = pickField(data, ['amountCents', 'amount_cents', 'valueCents', 'value_cents', 'cents']);
  if (cents != null && !Number.isNaN(Number(cents))) {
    amount = (Number(cents) / 100).toFixed(2);
  } else {
    const raw = pickField(data, ['amount', 'value', 'valor', 'total', 'gross']);
    if (raw != null) amount = String(raw);
  }
  const note =
    pickField(data, ['message', 'msg', 'comment', 'note', 'texto']) || '';
  return { user: String(user).slice(0, 40), amount, note: String(note).slice(0, 120) };
}

const MAX_BODY_BYTES = 64 * 1024;

function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    // compara mesmo assim pra não vazar o tamanho pelo tempo
    crypto.timingSafeEqual(bb, bb);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
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
  if (!secret) {
    ui.warn(
      'Webhook LivePix NÃO iniciado: defina LIVEPIX_WEBHOOK_SECRET no .env (obrigatório quando LIVEPIX_WEBHOOK_PORT está ativo).'
    );
    return { stop() {}, port: 0 };
  }

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
    const h = String(
      req.headers['x-livebot-secret'] || req.headers['x-webhook-secret'] || ''
    );
    if (!safeEqual(h, secret)) {
      res.writeHead(401);
      res.end('unauthorized');
      return;
    }

    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) {
      res.writeHead(413);
      res.end('payload too large');
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413);
        res.end('payload too large');
        req.destroy();
        return;
      }
      chunks.push(c);
    }
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

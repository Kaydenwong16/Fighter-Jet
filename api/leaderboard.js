// Global Fighter Jet leaderboard, backed by a Redis REST API (no SDK
// dependency needed). Vercel's Storage integrations inject credentials
// under different variable names depending on how the database was
// created, so both known conventions are checked — see README for setup.

const LIST_KEY = 'jetBattleLeaderboard';
const MAX_STORED = 200;
const TOP_N = 3;

const CREDENTIAL_CANDIDATES = [
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN']
];

function resolveCredentials() {
  for (const [urlKey, tokenKey] of CREDENTIAL_CANDIDATES) {
    const url = process.env[urlKey];
    const token = process.env[tokenKey];
    if (url && token) return { url, token };
  }
  return null;
}

async function upstash(url, token, command) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

module.exports = async (req, res) => {
  const creds = resolveCredentials();

  if (!creds) {
    // Names only, never values — safe to expose, and saves a round trip
    // when diagnosing which environment variables Vercel actually set.
    const checkedNames = CREDENTIAL_CANDIDATES.flat();
    res.status(500).json({
      error: 'Leaderboard storage is not configured yet.',
      checkedEnvVars: checkedNames,
      foundEnvVars: checkedNames.filter(k => process.env[k] !== undefined)
    });
    return;
  }
  const { url, token } = creds;

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = String(body.name || '').trim().slice(0, 14);
      const score = Math.max(0, Math.floor(Number(body.score) || 0));
      if (!name) {
        res.status(400).json({ error: 'Name is required.' });
        return;
      }
      await upstash(url, token, ['LPUSH', LIST_KEY, JSON.stringify({ name, score })]);
      await upstash(url, token, ['LTRIM', LIST_KEY, 0, MAX_STORED - 1]);
    } else if (req.method === 'DELETE') {
      // TEMPORARY: one-time cleanup of verification test entries. Remove
      // this branch after use — no standing wipe endpoint should ship.
      await upstash(url, token, ['DEL', LIST_KEY]);
      res.status(200).json({ ok: true });
      return;
    } else if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const raw = await upstash(url, token, ['LRANGE', LIST_KEY, 0, -1]);
    const top = (raw || [])
      .map(s => {
        try { return JSON.parse(s); } catch (e) { return null; }
      })
      .filter(e => e && typeof e.name === 'string' && typeof e.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    res.status(200).json({ top });
  } catch (e) {
    res.status(500).json({ error: 'Leaderboard request failed.', detail: e.message });
  }
};

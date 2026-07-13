// Global Fighter Jet leaderboard, backed by Upstash Redis (REST API, no SDK
// dependency needed). Requires UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN to be set as environment variables in the Vercel
// project — see README for the one-time setup step.

const LIST_KEY = 'jetBattleLeaderboard';
const MAX_STORED = 200;
const TOP_N = 3;

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
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    res.status(500).json({ error: 'Leaderboard storage is not configured yet.' });
    return;
  }

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
    res.status(500).json({ error: 'Leaderboard request failed.' });
  }
};

# Fighter-Jet

Kayden's Fun Zone — a kids' landing page (`Website/index.html`, served at `/`) with a rotating
hero video, linking through to Kayden's Jet Battle, a browser-based fighter jet shooter game
(`game/index.html`, served at `/game/`).

The root `vercel.json` rewrites `/` to `Website/index.html`; `/game/` is served automatically
from the `game/` folder.

## Play

Open `Website/index.html` for the landing page, or `game/index.html` to jump straight into the game.

## Controls

- **Arrow Keys / WASD** — move
- **Space** — shoot

## Global leaderboard setup

Players enter their name before playing, get 3 minutes on the clock, and the top 3 scores
are shown to every visitor via `/api/leaderboard` (`api/leaderboard.js`), backed by Upstash
Redis. This needs a one-time setup in the Vercel dashboard before it'll work:

1. Open the project on vercel.com → **Storage** tab → **Create Database** → **Upstash** →
   **Redis** (the free tier is enough). This automatically adds the `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN` environment variables to the project.
2. Redeploy (or just push again) so the new environment variables take effect.

Until this is done, `/api/leaderboard` returns an error and the game quietly falls back to
showing "No scores yet" instead of breaking.

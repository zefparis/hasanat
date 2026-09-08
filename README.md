# Hasanat

PWA mobile-first — React/Vite frontend + Node/Express backend, with real HCS-U7 cognitive identity integration. Pilot uses a mock backend (no real ledger / value moves until validated).

## Golden rule

HCS-U7 authenticates an **identity**, never a **devotional act**. Nowhere in code, i18n strings, or comments may the app say "prayer verified" or equivalent. The correct vocabulary everywhere is **"présence enregistrée" / "check-in"**, never "vérification de la prière".

## Stack

- **Frontend**: React 18 + Vite + TypeScript, PWA (Add to Home Screen), React Router
- **Backend**: Node + Express + TypeScript (pilot mock)
- **Deploy**: Vercel (frontend) + Render (backend)
- **Identity**: HCS-U7 / Hybrid Vector API (server-side only — browser never sees API keys or sends raw biometrics upstream)

## Commands

```bash
npm install          # install all workspaces
npm run dev          # client (5173) + server (8787) concurrently
npm run dev:client   # client only
npm run dev:server   # server only
npm run build        # build client + server
npm run start        # start server (production)
```

Client dev proxies `/api` to `http://localhost:8787`.

## Environment variables (server)

| Variable | Purpose | Default |
|---|---|---|
| `HCS_U7_BASE_URL` | Worker public entry | `https://api.hcs-u7.org` |
| `HV_API_KEY` | Server-side API key (X-API-Key through the Worker) | — |
| `HASANAT_TENANT_ID` | Tenant override (forced server-side) | `hasanat` |
| `HCS_U7_MOCK` | Forces honest local mock mode (pilot without creds) | — |
| `NODE_ENV` | Production flag | — |
| `PORT` | Server port | `8787` |

When `HCS_U7_MOCK=1` **or** `HV_API_KEY` is missing, calls resolve against a clearly-labeled local mock. The code path is identical — only the transport target changes. Set the env vars and unset `HCS_U7_MOCK` to go live.

`submitVerification()` routes through the HCS-U7 Worker at `{HCS_BASE}/hv/demoguard/verify`. The Worker adds X-HCS-Worker-Auth, WAF, bot detection, and header sanitization. Hasanat sends `X-API-Key` (HV_API_KEY) which passes through to the backend.

## HCS-U7 integration

The Hasanat Express backend is the **only** caller of the HCS-U7 / Hybrid Vector API. The browser client never sees an API key and never sends raw biometrics upstream.

### Routes (Hasanat proxy — the only browser surface)

| Route | Method | Purpose |
|---|---|---|
| `/api/hasanat/session` | POST | Creates HCS-U7 cognitive session |
| `/api/hasanat/verify` | POST | Submits hold-to-verify (returns `sid` + `verifiedAt`) |
| `/api/hasanat/session/:sid` | GET | Reads session status (no upstream poll; returns `verifiedAt`) |
| `/api/hasanat/signout` | POST | Revokes locally |
| `/api/hasanat/health` | GET | Health + mock status |

### Session badge — age-based, not polled

The badge (`Shield.tsx`) shows the age of the last real hold-to-verify (`"verified Xs ago"`), computed client-side from `verifiedAt`. There is **no 30s server poll** — the previous `rotationStatus()` call to `/api/tenant/rotation-status` was a dashboard endpoint (JWT cookie) that never worked server-to-server and has been removed.

### Re-verify before sensitive actions

Sensitive actions (Pay, Send, Pay Zakat) check `isStale()` before proceeding. If the last verification is older than `REVERIFY_THRESHOLD_MS` (5 minutes), a `HoldToVerify` modal re-triggers the real hold-to-verify flow. If the last verification is fresh, the action proceeds without friction. The prayer check-in is **exempt** — it reuses the existing session state without a re-hold.

### Reusable hold-to-verify

`client/src/components/HoldToVerify.tsx` is the single reusable component for the real HCS-U7 cognitive verification. It creates a session, captures the hold gesture, fires the verify call, and lights up the 4 checks from the backend response. Used by SignIn (step 3) and the re-verify gate modal.

### The 4 UI checks

`device bound`, `liveness`, `cognitive signature matched`, `secure session` are UI labels DERIVED from real response fields, not backend labels. See `sanitizeVerification()` in `server/src/services/hcs-u7.ts`.

### Hold-to-verify (real, not cosmetic)

The hold gesture fires a real API call. Checks light up ONLY from the backend response. Releasing before the response arrives = failure (no arbitrary front reset).

### Response sanitization

Mirrors `payguard/api/_lib/demoguardSanitize.ts` — strips raw biometrics, PII, JWTs, debug fields before the response reaches the browser.

## Deploy

### Frontend (Vercel)

- Auto-deploys from `main` branch
- `vercel.json` rewrites `/api/*` → Render backend URL
- Optional `VITE_API_BASE_URL` env var to override the API base (defaults to `/api`)

### Backend (Render)

- Auto-deploys from `main` branch
- Build: `npm run build` → `node dist/index.js`
- Requires `@types/*` and `typescript` in `dependencies` (not devDependencies — Render skips devDeps in production)
- Server uses CommonJS (not ESM) to avoid `.js` extension requirements on relative imports

## Project structure

```
hasanat/
├── client/               # React/Vite PWA
│   ├── src/
│   │   ├── components/    # Header, Shield, Nav, HoldToVerify, icons, Overlay
│   │   ├── lib/           # api.ts, auth.tsx, wallet.tsx, theme.tsx, toast.tsx
│   │   ├── screens/       # Home, SignIn, Wallet, Pay, Give, Prayer, Learn, Chats, Mosques, Businesses, Profile
│   │   └── styles/        # tokens.css, base.css, screens.css, nav.css
│   └── vite.config.ts
├── server/               # Node/Express
│   ├── src/
│   │   ├── routes/        # hasanat, prayer, wallet, chat, give, presence, explore
│   │   ├── services/      # hcs-u7, prayer, wallet, chat, give, presence, mosques, businesses, learn
│   │   └── index.ts
│   └── tsconfig.json
├── AGENTS.md             # Agent guide (build prompts, decisions, constraints)
└── package.json          # workspace root
```

## Pilot limitations

- **Mock ledger**: no real blockchain or value movement. Receipts are recorded locally.
- **Mock HCS-U7**: when `HCS_U7_MOCK=1`, all identity calls resolve locally. No real cognitive verification.
- **In-memory sessions**: the pilot session store is a server-side `Map` (no persistence across restarts).
- **No real banking**: redemption is disabled; the wallet is backed 1:1 by a notional reserve.

## License

Private pilot.

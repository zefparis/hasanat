# Hasanat

PWA mobile-first app — React/Vite frontend + Node/Express backend, with real HCS-U7 identity integration. Pilot uses a mock backend (no real ledger / value moves until validated).

## Golden rule (product + religious constraint)

HCS-U7 authenticates an **identity**, never a **devotional act**. Nowhere in code, i18n strings, or comments may the app say "prayer verified" or equivalent. The correct vocabulary everywhere is **"présence enregistrée" / "check-in"**, never "vérification de la prière".

## Stack

- Frontend: React 18 + Vite + TypeScript, PWA (Add to Home Screen), React Router
- Backend: Node + Express + TypeScript (pilot mock)
- Deploy target: Render (backend) + Cloudflare in front of the existing HCS-U7 API

## Commands (run from repo root)

```bash
npm install          # install all workspaces
npm run dev          # client (5173) + server (8787) concurrently
npm run dev:client   # client only
npm run dev:server   # server only
npm run build        # build client + server
```

Client dev proxies `/api` to `http://localhost:8787`.

## Build prompts (sequential, GLM)

1. Setup + design system (this commit)
2. Auth + real HCS-U7 integration
3. Home + Wallet + Pay
4. Give + Chats
5. Learn + Prayer + check-in level 1 + Mosques + Businesses + Profile
6. QA / polish (charter consistency day/night, vocabulary audit, error states)

## Decisions (section 6)

- Stack: PWA React/Vite + Node
- Deploy: Render + Cloudflare (idem Guards)
- Backend HAS: mock volontaire for the pilot

## HCS-U7 integration (prompt 2)

The Hasanat Express backend is the ONLY caller of the HCS-U7 / Hybrid Vector API.
The browser client never sees an API key and never sends raw biometrics upstream.

### Env vars (server)
- `HCS_U7_BASE_URL` — public entry, e.g. `https://api.hcs-u7.org`
- `HV_API_URL` — Hybrid Vector API base
- `HV_API_KEY` — server-side API key injected on upstream calls
- `HASANAT_TENANT_ID` — tenant override forced server-side (client cannot spoof)
- `HCS_U7_MOCK=1` — forces honest local mock mode (pilot without creds)

When `HCS_U7_MOCK=1` OR `HV_API_URL`/`HV_API_KEY` are missing, calls resolve against
a clearly-labeled local mock. The code path is identical — only the transport
target changes. Set the env vars and unset `HCS_U7_MOCK` to go live.

### Routes (Hasanat proxy — the only browser surface)
- `POST /api/hasanat/session` → creates HCS-U7 cognitive session (real: `POST /api/cognitive/liveguard/session`)
- `POST /api/hasanat/verify` → submits hold-to-verify (real: `POST /demoguard/verify` on HV API; forces tenant+source server-side; sanitizes response)
- `GET  /api/hasanat/session/:sid` → polls 30s QSIG rotation (real: `GET /api/tenant/rotation-status`)
- `POST /api/hasanat/signout` → revokes locally (no public HCS-U7 sign-out endpoint exists)

### The 4 UI checks
`device bound`, `liveness`, `cognitive signature matched`, `secure session` are UI
labels DERIVED from real response fields, not backend labels. See
`sanitizeVerification()` in `server/src/services/hcs-u7.ts`.

### Hold-to-verify (real, not cosmetic)
The hold gesture fires a real API call. Checks light up ONLY from the backend
response. Releasing before the response arrives = failure (no arbitrary front
reset). See `client/src/screens/SignIn.tsx`.

### Response sanitization
Mirrors `payguard/api/_lib/demoguardSanitize.ts` — strips raw biometrics, PII,
JWTs, debug fields before the response reaches the browser.

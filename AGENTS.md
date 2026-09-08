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
- `HCS_U7_BASE_URL` — Worker public entry, e.g. `https://api.hcs-u7.org`
- `HV_API_KEY` — server-side API key sent as X-API-Key through the Worker
- `HASANAT_TENANT_ID` — tenant override forced server-side (client cannot spoof)
- `HCS_U7_MOCK=1` — forces honest local mock mode (pilot without creds)

When `HCS_U7_MOCK=1` OR `HV_API_KEY` is missing, calls resolve against
a clearly-labeled local mock. The code path is identical — only the transport
target changes. Set the env vars and unset `HCS_U7_MOCK` to go live.

`submitVerification()` routes through the Worker at `{HCS_BASE}/hv/demoguard/verify`.
The Worker adds X-HCS-Worker-Auth, WAF, bot detection, and header sanitization.
Hasanat sends `X-API-Key` (HV_API_KEY) which passes through to the backend.

### Routes (Hasanat proxy — the only browser surface)
- `POST /api/hasanat/session` → creates HCS-U7 cognitive session (real: `POST /api/cognitive/liveguard/session`)
- `POST /api/hasanat/verify` → submits hold-to-verify (real: `POST /hv/demoguard/verify` via the Worker; forces tenant+source server-side; sanitizes response; returns `verifiedAt`)
- `GET  /api/hasanat/session/:sid` → reads session status (no upstream poll; returns `verifiedAt` from the in-memory session)
- `POST /api/hasanat/signout` → revokes locally (no public HCS-U7 sign-out endpoint exists)

### Session badge — age-based, not polled
The badge (`Shield.tsx`) shows the age of the last real hold-to-verify
(`"verified Xs ago"`), computed client-side from `verifiedAt`. There is **no
30s server poll** — the previous `rotationStatus()` call to
`/api/tenant/rotation-status` was a dashboard endpoint (JWT cookie) that
never worked server-to-server and has been removed entirely.

### Re-verify before sensitive actions
Sensitive actions (Pay, Send, Pay Zakat) check `isStale()` before proceeding.
If the last verification is older than `REVERIFY_THRESHOLD_MS` (5 minutes),
a `HoldToVerify` modal re-triggers the real hold-to-verify flow. If the last
verification is fresh, the action proceeds without friction. The prayer
check-in is **exempt** — it reuses the existing session state without a
re-hold (low-stakes action, no over-friction).

### Reusable hold-to-verify
`client/src/components/HoldToVerify.tsx` is the single reusable component for
the real HCS-U7 cognitive verification. It creates a session, captures the
hold gesture, fires the verify call, and lights up the 4 checks from the
backend response. Used by SignIn (step 3) and the re-verify gate modal.

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

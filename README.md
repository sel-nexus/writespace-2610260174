# WriteSpace

WriteSpace is a standalone React/Vite browser-local blogging demo with a public landing page, local registration and login, post reading and ownership-aware editing, and an admin dashboard with local account management.

## Safety and data

**This is not security.** Accounts, plaintext passwords, roles and sessions are editable in browser localStorage; the built-in demo administrator is `admin` / `admin`. Anyone with access to the browser or same-origin scripts can read or change these values and bypass the UI. Do not use real passwords, sensitive information, or this demo as a trusted authentication system. There is no backend, encryption, hashing, shared identity, synchronization or backup. Data is local to one browser and origin, can be cleared or lost, and simultaneous tab writes are last-writer-wins.

The app uses `writespace_users`, `writespace_posts` and `writespace_session`. A corrupt or inaccessible collection is shown as empty for reading, but registration refuses to replace unreadable or malformed user data. Registration saves the account before the session; if the second write fails it reports partial registration and directs the user to log in rather than creating a duplicate or rolling back. Logout only reports success when session removal succeeds. Username and password comparisons are literal and case-sensitive; only the exact username `admin` is reserved. The permanent demo admin is synthesized, not stored as a user.

## Run locally

Requirements: Node 20 or newer and npm. From the repository root:

```sh
cd frontend
npm ci --no-bin-links
npm run dev
```

Open the URL printed by Vite. A secure context such as localhost is needed for `crypto.randomUUID()` and localStorage must be available. No environment variables or backend configuration are required. Production build: `npm run build`; preview: `npm run preview`. The built site is in `frontend/dist`. Serve it with SPA history fallback for direct routes. For the provided container, run `docker build -t writespace ./frontend` and `docker run --rm -p 8080:80 writespace`; nginx falls back to `index.html` and exposes `/healthz`.

## Tests

From `frontend`, run `node node_modules/vitest/vitest.mjs run` for the full unit and component suite. Playwright uses exactly 1.64.1 and the full Chromium channel. After installing the matching browser if needed, discover tests with `node node_modules/@playwright/test/cli.js test --list` and run `node node_modules/@playwright/test/cli.js test`. The config starts its own local Vite server on port 4173. Browser tests and deployed-origin checks are separate from the unit suite; no hosted behavior is implied by a local build.

## Structure and constraints

`src/utils` contains status-aware storage and demo identity operations. `App.jsx` owns the session and cross-tab storage listener. Pages and components implement public, authoring and admin workflows. Account deletion retains posts and author-name snapshots; total user and admin counts include the permanent admin, while the regular-user count excludes admins. An em dash represents its unknown creation date and unknown author roles use a neutral avatar. Performance acceptance and deployed-origin rewrites require downstream verification. The v6 React Router dependency has two moderate npm audit advisories; upgrading to v7 requires a separate architecture decision.

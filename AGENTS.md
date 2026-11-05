# SLAGO Awards: guide for Codex

## Project at a glance

Static Russian-language community awards and voting site. There is no package manager, build step, or frontend framework: pages load CSS and JavaScript directly. The public page uses Supabase for nominations, votes, Discord OAuth, and profile suggestions. The admin page uses protected Supabase RPCs. Keep the `slago_` database namespace; the Supabase project is also used by Secret Gate Ratings.

## Where to look

- `index.html`: public voting page markup and element IDs consumed by `app.js`.
- `app.js`: public page behavior: Supabase setup, nominations and profile loading, Discord auth, ballot selection/submission, voting schedule, closed-vote carousel, realtime updates.
- `admin.html`: administrator page markup and element IDs consumed by `admin.js`.
- `admin.js`: admin auth/authorization, schedule and results settings, statistics and vote history via RPCs.
- `styles.css`: all shared site and admin styles. Search by the page's class or ID before changing layout.
- `images/`: site artwork and icon; `images/nominations/` contains nomination-specific images mapped by slug in `app.js`.
- `candidates.txt`: source list of candidate data; inspect before editing/importing nominees.
- `supabase/schema.sql`: initial Slago tables and policies.
- `supabase/migrations/`: later schema and feature changes. Read the relevant migration before changing a DB-dependent feature.
- Other `supabase/*.sql`: imports, Discord ID mapping/sync, realtime setup. These are operational scripts, not browser code.
- `README.md`: deployment, Supabase/Discord setup, and operational details. Prefer UTF-8 when reading; some terminals may display Russian text incorrectly.

## Fast navigation

- Public page structure or visible copy: start at `index.html`; behavior/IDs at `app.js`.
- Candidate/nominations display, selection, submission, or login: `app.js`, then relevant markup in `index.html`; DB changes also require checking `supabase/`.
- Admin controls or access: `admin.html` + `admin.js`, then the corresponding SQL RPC/migration.
- Visual change: `styles.css` and the relevant page markup. There is no component framework.
- Nomination artwork: slug mapping in `app.js` and corresponding file under `images/nominations/`.
- Voting windows, result finality, admin statistics: inspect RPC definitions in `supabase/migrations/` before changing client assumptions.

## Working constraints

- Keep this a static site unless explicitly asked to add tooling or a framework.
- Preserve existing element IDs and data attributes used by JS when editing markup; update both sides together if they must change.
- Treat Supabase schema, RLS, RPCs, and client code as one contract. Browser code should only use the public/publishable key; never introduce a service-role secret.
- Do not modify unrelated Secret Gate tables or behavior. Slago tables use the `slago_` prefix.
- Do not infer current DB state from SQL files alone: migrations may already have been applied remotely. Explain any required SQL operation separately.
- Avoid broad project scans for routine changes; use the map above and search the named file for the relevant selector/function/RPC.
- No test/build scripts are currently configured. For a small change, inspect the affected markup, JS, CSS, and SQL contract directly; do not invent a build pipeline.

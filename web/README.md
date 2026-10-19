# Trusted Data Foundation demo: web UI

Vite + React 18 + TypeScript single-page app. Works fully offline (system fonts, no CDN).
It talks to the Python API under `/api` (contract: `src/api/types.ts`, client: `src/api/client.ts`).

## Develop

```bash
cd web
npm install
# in another terminal, from the repo root: start the API on 127.0.0.1:8765
npm run dev        # Vite dev server; /api is proxied to http://127.0.0.1:8765
```

## Build

```bash
npm run build      # tsc --noEmit, then vite build -> web/dist
```

`web/dist` is committed and served by the API, so rebuild and commit it after UI changes.

## Layout

- `src/pages/` one file per tab (Start here, Architecture, Pipeline, SQL Explorer, Dashboard); proposal text lives in `pages/architectureContent.ts`.
- `src/diagrams/` custom HTML/SVG diagrams. `architectureLayout.ts` holds node/edge coordinates on a fixed canvas; `ScaledCanvas.tsx` scales it to the container and computes bezier connectors.
- `src/components/` shared UI (cards, tabs, stepper, status polling).
- Logos: individual `simple-icons` imports. Not in simple-icons: Amazon S3, dbt, Apache Iceberg, Debezium (lucide icon or text mark used instead).
- Routing is hash based: `#start`, `#architecture`, `#pipeline`, `#sql`, `#dashboard`.

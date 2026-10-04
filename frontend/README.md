# Fair Drop frontend

React + TypeScript + Vite participant and fairness-control experiences.

## Run locally

```sh
npm install
npm run dev
```

The app starts in **mock mode** and does not require the backend. Open `/` for the participant drop page and `/?page=admin` for the control center.

## API adapter configuration

The app defaults to `VITE_FAIR_DROP_MODE=mock`. To use the adapter for the existing backend endpoints, set:

```sh
VITE_FAIR_DROP_MODE=http
VITE_API_BASE_URL=http://localhost:3000/api
```

The current backend does not expose traffic telemetry, fairness metrics, session restoration, or simulation endpoints. Those fields remain unavailable or demo-labelled in HTTP mode. The HTTP adapter maps only endpoints that currently exist; simulation remains local to mock mode.

```sh
npm run build
npm run preview
```

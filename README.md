# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Prothomuse Dashboard - local dev notes ✅

- Install new dependencies: `npm install` (adds `zustand` and `react-router-dom`).
- Environment: set `VITE_API_BASE` and `VITE_WS_URL` in a `.env` file for API and WebSocket endpoints.
- Start the app: `npm run dev`.

This workspace contains skeleton pages, a simple Zustand store, `services/api.js` stubs, and `services/socket.js` for WebSocket connections. Replace stubs with real API endpoints and integrate charts (e.g., Chart.js or Recharts) as needed.

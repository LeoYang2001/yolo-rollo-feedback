import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config.
//
// Local dev: Vite serves the frontend on 5174 and proxies /api to a
// `vercel dev` instance on 3001 that runs the serverless functions in
// api/. Run both with `npm run dev:full` (or two terminals: `npm run
// dev` + `npm run api`).
//
// Why the proxy instead of running the whole app through `vercel dev`:
// the SPA rewrite in vercel.json (needed in production so deep links
// like /thanks resolve to index.html) also intercepts Vite's dev module
// requests under `vercel dev`, which breaks HMR / the module graph. So
// in dev we let Vite own the frontend and only forward /api.
//
// Production: Vercel serves /api/* as functions and applies the
// vercel.json rewrite for client routes — no proxy involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // different from the ordering app (5173) so both can run
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

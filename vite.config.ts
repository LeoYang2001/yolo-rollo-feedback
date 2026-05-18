import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config — keep it minimal. API routes live under /api and are
// served by Vercel serverless functions in prod; `vercel dev` proxies
// them locally. No need for a manual proxy here.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // different from the ordering app (5173) so both can run
  },
});

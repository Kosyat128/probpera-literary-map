import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const configuredBase = environment.PUBLIC_SITE_BASE_PATH || "/probpera-literary-map/";
  const base = configuredBase === "/" ? "/" : `/${configuredBase.replace(/^\/+|\/+$/g, "")}/`;

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      open: true
    }
  };
});

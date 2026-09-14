import path from 'node:path';
import config from '../../playwright.pwa-current.config.mjs';
const { webServer: _unused, ...existing } = config;
export default { ...existing, testDir: path.resolve(process.cwd(), 'tests/pwa'), testMatch: 'offline-catalog.spec.mjs',
  grep: /orange PWA launch and bilingual recovery lead to the retained offline literary globe/,
  projects: existing.projects.filter(project => project.name === 'pwa-desktop').map(project => ({ ...project, use: { ...project.use, deviceScaleFactor: 2 } })),
};

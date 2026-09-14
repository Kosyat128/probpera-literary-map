import path from 'node:path';
import config from '../../playwright.pwa-current.config.mjs';
const { webServer: _unused, ...existing } = config;
export default { ...existing, testDir: path.resolve(process.cwd(), 'tests/pwa'), testMatch: 'offline-catalog.spec.mjs',
  grep: /offline PWA book-to-writer return preserves the globe and eligible country facts across RU and EN/,
  projects: existing.projects.filter(project => project.name === 'pwa-desktop').map(project => ({ ...project, use: { ...project.use, deviceScaleFactor: 2 } })),
};

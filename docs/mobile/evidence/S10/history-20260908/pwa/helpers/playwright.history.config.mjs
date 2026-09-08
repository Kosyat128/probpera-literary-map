import path from 'node:path';
import config from '../../playwright.pwa-current.config.mjs';
const { webServer: _unused, ...existing } = config;
export default { ...existing, testDir: path.resolve(process.cwd(), 'tests/pwa'), testMatch: 'offline-catalog.spec.mjs',
  grep: /recent writer opens outside the active country filter without replacing the globe/,
  projects: existing.projects.filter(project => project.name === 'pwa-desktop').map(project => ({ ...project, use: { ...project.use, deviceScaleFactor: 2 } })),
};

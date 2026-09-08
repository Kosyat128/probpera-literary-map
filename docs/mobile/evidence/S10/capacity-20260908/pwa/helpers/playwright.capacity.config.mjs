import path from 'node:path';
import config from '../../playwright.pwa-current.config.mjs';
const { webServer: _unused, ...existing } = config;
export default { ...existing, testDir: path.resolve(process.cwd(), 'tests/pwa'), testMatch: 'controlled-pwa.spec.mjs',
  grep: /expanded portrait base installs and verifies real offline bytes with saved graphics and bilingual scene/,
  projects: existing.projects.filter(project => project.name === 'pwa-desktop').map(project => ({ ...project, use: { ...project.use, deviceScaleFactor: 2 } })),
};

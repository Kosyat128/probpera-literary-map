import path from 'node:path';
import config from '../../playwright.pwa-current.config.mjs';
const { webServer: _unused, ...existing } = config;
// The authorized orchestrator keeps the exact build's ephemeral signer alive.
// Reusing it avoids rebuilding or replacing authority between audit and browser.
export default { ...existing, testDir: path.resolve(process.cwd(), 'tests/pwa'),
  testMatch: 'controlled-pwa.spec.mjs',
  grep: /device preparation restores real offline bytes and keeps simulated browser decisions truthful/,
};

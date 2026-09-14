import config from '../../playwright.native-planet.config.mjs';
export default { ...config, testDir: '../../tests/host', testMatch: 'native-planet.spec.mjs',
 grep: /downloads live in the actual globe collection/,
 retries: 0, workers: 1, outputDir: './globe-output-' + process.env.S11_ATTEMPT,
 reporter: [['json', { outputFile: process.env.S11_BROWSER_REPORT }]],
};

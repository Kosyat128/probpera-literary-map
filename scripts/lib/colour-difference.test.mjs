import assert from "node:assert/strict";
import { test } from "vitest";
import { deltaE2000, srgbToLab } from "./colour-difference.mjs";

// Published supplementary reference pairs: blue, neutral, hue boundary and dark.
// https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
const pairs = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.49, -.001], [50, -2.49, .0009], 7.1792],
  [[50, 2.49, -.001], [50, -2.49, .001], 7.1792],
  [[50, 2.49, -.001], [50, -2.49, .0011], 7.2195],
  [[50, -.001, 2.49], [50, .0011, -2.49], 4.7461],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[6.7747, -.2908, -2.4247], [5.8714, -.0985, -2.2286], .6377],
  [[2.0776, .0795, -1.135], [.9033, -.0636, -.5514], .9082],
];
test("CIEDE2000 agrees with independent published reference pairs in both directions", () => {
  for (const [first, second, expected] of pairs) {
    assert.ok(Math.abs(deltaE2000(first, second) - expected) < .00005, String(expected));
    assert.ok(Math.abs(deltaE2000(second, first) - expected) < .00005, String(expected));
    assert.equal(deltaE2000(first, first), 0);
  }
});
test("D65 sRGB conversion preserves black and reference white", () => {
  assert.deepEqual(srgbToLab([0, 0, 0]), [0, 0, 0]);
  const white = srgbToLab([255, 255, 255]);
  assert.ok(Math.abs(white[0] - 100) < .0001);
  assert.ok(Math.abs(white[1]) < .0001 && Math.abs(white[2]) < .0001);
});

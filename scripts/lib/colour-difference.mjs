// CIEDE2000, kL=kC=kH=1; Sharma, Wu, Dalal (2005), equations 2-22.
// https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf
export const COLOUR_DIFFERENCE_VERSION = "ciede2000-sharma-2005-v1";

export function srgbToLab([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map(value => value / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047,
    r * .2126729 + g * .7151522 + b * .072175,
    (r * .0193339 + g * .119192 + b * .9503041) / 1.08883];
  const [x, y, z] = xyz.map(value => value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE2000([l1, a1, b1], [l2, a2, b2]) {
  const radians = angle => angle * Math.PI / 180;
  const cMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = .5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1), cp2 = Math.hypot(ap2, b2);
  const hue = (a, b) => a === 0 && b === 0 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  const hp1 = hue(ap1, b1), hp2 = hue(ap2, b2);
  const deltaL = l2 - l1, deltaC = cp2 - cp1;
  let deltaHue = hp2 - hp1;
  if (cp1 * cp2 === 0) deltaHue = 0;
  else if (deltaHue > 180) deltaHue -= 360;
  else if (deltaHue < -180) deltaHue += 360;
  const deltaH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(radians(deltaHue / 2));
  const lpMean = (l1 + l2) / 2, cpMean = (cp1 + cp2) / 2;
  let hpMean = (hp1 + hp2) / 2;
  if (cp1 * cp2 === 0) hpMean = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) > 180) hpMean += hp1 + hp2 < 360 ? 180 : -180;
  const t = 1 - .17 * Math.cos(radians(hpMean - 30)) + .24 * Math.cos(radians(2 * hpMean)) +
    .32 * Math.cos(radians(3 * hpMean + 6)) - .20 * Math.cos(radians(4 * hpMean - 63));
  const theta = 30 * Math.exp(-(((hpMean - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7));
  const sl = 1 + .015 * (lpMean - 50) ** 2 / Math.sqrt(20 + (lpMean - 50) ** 2);
  const sc = 1 + .045 * cpMean, sh = 1 + .015 * cpMean * t;
  const rt = -Math.sin(radians(2 * theta)) * rc;
  const dl = deltaL / sl, dc = deltaC / sc, dh = deltaH / sh;
  return Math.sqrt(dl ** 2 + dc ** 2 + dh ** 2 + rt * dc * dh);
}

export type WriterStudySketchPoint = readonly [x: number, z: number];
export type WriterStudySketchStroke = Readonly<{
  points: readonly WriterStudySketchPoint[];
  closed: boolean;
  thickness: number;
}>;

const stroke = (points: readonly WriterStudySketchPoint[], closed: boolean, thickness = .0018): WriterStudySketchStroke =>
  Object.freeze({ points: Object.freeze(points.map(([x, z]) => Object.freeze([x, z] as const))), closed, thickness });

/** Original decorative island sketch, shared by the physical sheet and its
 * accessible inspection view. It contains no factual geography or attribution. */
export const WRITER_STUDY_SKETCH = Object.freeze({
  width: .70,
  height: .94,
  tension: .20,
  strokes: Object.freeze([
    stroke([[-.24,-.28],[-.17,-.34],[-.10,-.29],[-.11,-.19],[-.04,-.10],[-.08,-.04],
      [-.02,.03],[-.09,.14],[-.17,.12],[-.22,.20],[-.25,.09],[-.20,.01],[-.25,-.11]], true),
    stroke([[.02,-.24],[.09,-.29],[.20,-.23],[.19,-.14],[.25,-.08],[.20,.03],
      [.24,.10],[.16,.18],[.12,.31],[.04,.26],[.07,.17],[.03,.09],[.09,.01],[.04,-.11]], true),
    stroke([[-.02,.25],[-.07,.30],[-.03,.35],[.025,.31]], true),
    stroke([[.14,-.20],[.12,-.11],[.16,-.03],[.13,.06],[.15,.14]], false, .00125),
    stroke([[-.21,-.24],[-.18,-.20],[-.16,-.23],[-.13,-.18]], false, .00125),
    stroke([[-.225,.285],[-.225,.355]], false, .00125),
    stroke([[-.260,.32],[-.190,.32]], false, .00125),
  ]),
});

/** Cubic Bezier projection of the same uniform Catmull-Rom curve used by the
 * sheet's Three geometry. No Three, DOM, raster image or renderer is needed. */
export function writerStudySketchSvgPath({ points, closed }: WriterStudySketchStroke): string {
  const count = points.length;
  if (count < 2) return "";
  const coordinate = (point: WriterStudySketchPoint) => `${point[0]},${point[1]}`;
  if (count === 2) return `M${coordinate(points[0])}L${coordinate(points[1])}`;
  const extrapolate = (end: WriterStudySketchPoint, adjacent: WriterStudySketchPoint): WriterStudySketchPoint =>
    [2 * end[0] - adjacent[0], 2 * end[1] - adjacent[1]];
  const tangentScale = WRITER_STUDY_SKETCH.tension / 3;
  let path = `M${coordinate(points[0])}`;
  for (let index = 0; index < (closed ? count : count - 1); index++) {
    const p1 = points[index], p2 = points[(index + 1) % count];
    const p0 = closed || index > 0 ? points[(index - 1 + count) % count] : extrapolate(p1, p2);
    const p3 = closed || index + 2 < count ? points[(index + 2) % count] : extrapolate(p2, p1);
    const c1: WriterStudySketchPoint = [p1[0] + (p2[0] - p0[0]) * tangentScale, p1[1] + (p2[1] - p0[1]) * tangentScale];
    const c2: WriterStudySketchPoint = [p2[0] - (p3[0] - p1[0]) * tangentScale, p2[1] - (p3[1] - p1[1]) * tangentScale];
    path += `C${coordinate(c1)} ${coordinate(c2)} ${coordinate(p2)}`;
  }
  return closed ? `${path}Z` : path;
}

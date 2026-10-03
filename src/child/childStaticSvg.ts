/** Closed static SVG grammar for reviewed child-only image bytes. This is a
 * resource/active-content boundary, never an age, rights or editorial receipt.
 * It does not modify canonical source assets. No XML/DOM parser, entity resolver,
 * CSS, script, text, image, font, filter, animation or external URL is admitted.
 * Local definitions must form a bounded DAG, including clip and marker references.
 * Markers are a deliberately smaller subset: fixed zero orientation, no viewBox,
 * local references on linear path/line/polyline/polygon geometry only. Weighted
 * expansion, accumulated vertices, inherited stroke scale and viewport corners
 * are checked before any native allocation; marker styles use definition ancestry.
 * This conservative subset may deny a complex canonical flag; never redraw it
 * or weaken validation to obtain an apparent complete inventory. */
export const CHILD_SVG_MAX_BYTES = 256 * 1024;
export const CHILD_SVG_MAX_NODES = 4096;
export const CHILD_SVG_MAX_DEPTH = 64;
export const CHILD_SVG_MAX_ATTRIBUTES = 32;
export const CHILD_SVG_MAX_ATTRIBUTE_LENGTH = 65536;
export const CHILD_SVG_MAX_NUMBERS = 65536;
export const CHILD_SVG_MAX_EXPANDED_NODES = 16384;
export const CHILD_SVG_MAX_EXPANDED_NUMBERS = 131072;
export const CHILD_SVG_MAX_DIMENSION = 2048;
export const CHILD_SVG_MAX_PIXELS = 4 * 1024 * 1024;
const COORDINATE = 32768;
const tags = new Set(["svg", "g", "defs", "clipPath", "marker", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const containers = new Set(["svg", "g", "defs", "clipPath", "marker"]);
const markerAttributes = new Set(["marker-start", "marker-mid", "marker-end"]);
const markerShapes = new Set(["path", "line", "polyline", "polygon"]);
const paintAttributes = new Set(["id", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
  "stroke-dasharray", "stroke-dashoffset", "opacity", "fill-opacity", "stroke-opacity", "transform", "clip-path", ...markerAttributes]);
const geometry: Readonly<Record<string, readonly string[]>> = { svg: ["xmlns", "xmlns:xlink", "viewBox", "width", "height"], g: [], defs: [],
  marker: ["markerUnits", "markerWidth", "markerHeight", "refX", "refY", "orient"],
  clipPath: ["clipPathUnits"], use: ["href", "xlink:href", "x", "y", "width", "height"], path: ["d"], rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"], line: ["x1", "y1", "x2", "y2"], polyline: ["points"], polygon: ["points"] };
type Header = Readonly<{ kind: "image"; width: number; height: number }>;
type Matrix = readonly number[];
type Point = readonly [number, number];
type Marker = { width: number; height: number; refX: number; refY: number; strokeUnits: boolean };
type Node = { tag: string; attributes: Record<string, string>; children: number[]; refs: { id: string; kind: "use" | "clip" | "marker" }[];
  numbers: number; matrix: Matrix; stroke: number | null; lexicalStroke: number; vertices: Point[]; marker: Marker | null };
type Parsed = { header: Header; source: string; rootEnd: number; selfClosing: boolean; nodes: Node[] };
const numberPattern = /[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/y;
const namePattern = /[A-Za-z][A-Za-z0-9:_-]*/y;
const identifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_.-]{0,95}$/u.test(value);
const space = (value: string) => /^[\t\n\r ]*$/u.test(value);
function insist(value: boolean): asserts value { if (!value) throw new Error("child-svg-unavailable"); }
function numbers(value: string, maximum: number): number[] {
  const result: number[] = []; let at = 0, comma = false;
  while (at < value.length) {
    if (/[\t\n\r ]/u.test(value[at])) { at++; continue; }
    if (value[at] === ",") { insist(result.length > 0 && !comma); comma = true; at++; continue; }
    numberPattern.lastIndex = at; const match = numberPattern.exec(value); insist(!!match && result.length < maximum);
    const number = Number(match[0]); insist(Number.isFinite(number) && Math.abs(number) <= COORDINATE);
    result.push(number); comma = false; at = numberPattern.lastIndex;
  }
  insist(!comma && result.length > 0); return result;
}
function pathNumbers(value: string): number {
  const arities: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  let at = 0, command = "", count = 0, total = 0, comma = false; const group: number[] = [];
  const complete = () => insist(command !== "" && (arities[command] === 0 ? count === 0 : count > 0 && count % arities[command] === 0));
  while (at < value.length) {
    const character = value[at];
    if (/[\t\n\r ]/u.test(character)) { at++; continue; }
    if (character === ",") { insist(count > 0 && !comma); comma = true; at++; continue; }
    const upper = character.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(arities, upper)) {
      insist(!comma); if (command) complete(); else insist(upper === "M");
      command = upper; count = 0; group.length = 0; at++; continue;
    }
    insist(command !== "" && arities[command] > 0 && ++total <= CHILD_SVG_MAX_NUMBERS);
    numberPattern.lastIndex = at; const match = numberPattern.exec(value); insist(!!match);
    const number = Number(match[0]); insist(Number.isFinite(number) && Math.abs(number) <= COORDINATE);
    count++; comma = false; group.push(number); at = numberPattern.lastIndex;
    if (group.length === arities[command]) {
      if (command === "A") insist(group[0] >= 0 && group[1] >= 0 && (group[3] === 0 || group[3] === 1) && (group[4] === 0 || group[4] === 1));
      group.length = 0;
    }
  }
  insist(!comma); complete(); return total;
}
/** Only marker-bearing paths use this linear endpoint grammar. The existing
 * curve/arc validator remains unchanged for paths without marker references. */
function markerVertices(node: Node): Point[] {
  const points: Point[] = [];
  const add = (x: number, y: number) => {
    insist(Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= COORDINATE && Math.abs(y) <= COORDINATE
      && points.length < CHILD_SVG_MAX_EXPANDED_NODES); points.push([x, y]);
  };
  const scalar = (key: string) => node.attributes[key] === undefined ? 0 : numbers(node.attributes[key], 1)[0];
  if (node.tag === "line") { add(scalar("x1"), scalar("y1")); add(scalar("x2"), scalar("y2")); }
  else if (node.tag === "polyline" || node.tag === "polygon") {
    const list = numbers(node.attributes.points ?? "", CHILD_SVG_MAX_NUMBERS);
    for (let index = 0; index < list.length; index += 2) add(list[index], list[index + 1]);
    if (node.tag === "polygon") add(points[0][0], points[0][1]);
  } else {
    const value = node.attributes.d; insist(typeof value === "string");
    let at = 0, command = "", firstMove = false, x = 0, y = 0, startX = 0, startY = 0; const group: number[] = [];
    while (at < value.length) {
      const character = value[at]; if (/[\t\n\r ,]/u.test(character)) { at++; continue; }
      if (/[A-Za-z]/u.test(character)) {
        insist(/[MmLlHhVvZz]/u.test(character)); command = character; firstMove = character.toUpperCase() === "M"; at++;
        if (character.toUpperCase() === "Z") { x = startX; y = startY; add(x, y); }
        continue;
      }
      const upper = command.toUpperCase(); insist(upper === "M" || upper === "L" || upper === "H" || upper === "V");
      numberPattern.lastIndex = at; const match = numberPattern.exec(value); insist(!!match); group.push(Number(match[0])); at = numberPattern.lastIndex;
      if (group.length === (upper === "H" || upper === "V" ? 1 : 2)) {
        const relative = command !== upper;
        if (upper === "H") x = group[0] + (relative ? x : 0);
        else if (upper === "V") y = group[0] + (relative ? y : 0);
        else { x = group[0] + (relative ? x : 0); y = group[1] + (relative ? y : 0); }
        add(x, y); if (firstMove) { startX = x; startY = y; firstMove = false; } group.length = 0;
      }
    }
  }
  insist(points.length > 0); return points;
}
function multiply(first: Matrix, second: Matrix): Matrix {
  const [a, b, c, d, e, f] = first, [g, h, i, j, k, l] = second;
  const matrix = [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
  insist(matrix.every(number => Number.isFinite(number) && Math.abs(number) <= COORDINATE)); return matrix;
}
function transformNumbers(value: string): { numbers: number; matrix: Matrix } {
  let at = 0, count = 0, total = 0, matrix = [1, 0, 0, 1, 0, 0];
  while (at < value.length) {
    const match = /^\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/u.exec(value.slice(at));
    insist(!!match && ++count <= 32); const args = numbers(match[2], 6); total += args.length; at += match[0].length;
    let next: number[];
    if (match[1] === "matrix") { insist(args.length === 6); next = args; }
    else if (match[1] === "translate") { insist(args.length <= 2); next = [1, 0, 0, 1, args[0], args[1] ?? 0]; }
    else if (match[1] === "scale") { insist(args.length <= 2); next = [args[0], 0, 0, args[1] ?? args[0], 0, 0]; }
    else if (match[1] === "rotate") {
      insist(args.length === 1 || args.length === 3); const radians = args[0] * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians), x = args[1] ?? 0, y = args[2] ?? 0;
      next = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
    } else { insist(args.length === 1); const tangent = Math.tan(args[0] * Math.PI / 180); next = match[1] === "skewX" ? [1, 0, tangent, 1, 0, 0] : [1, tangent, 0, 1, 0, 0]; }
    matrix = [...multiply(matrix, next)];
    if (space(value.slice(at))) { at = value.length; break; }
  }
  insist(count > 0); return { numbers: total, matrix };
}
function validate(node: Node, root: boolean): void {
  const attributes = node.attributes;
  for (const [name, value] of Object.entries(attributes)) {
    insist(paintAttributes.has(name) || geometry[node.tag].includes(name));
    if (name === "id") insist(identifier(value));
    else if (name === "xmlns") insist(root && value === "http://www.w3.org/2000/svg");
    else if (name === "xmlns:xlink") insist(root && value === "http://www.w3.org/1999/xlink");
    else if (name === "viewBox") { const list = numbers(value, 4); insist(root && list.length === 4 && list[2] > 0 && list[3] > 0); node.numbers += 4; }
    else if (name === "fill" || name === "stroke") insist(/^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|none|black|white|red|green|blue|yellow|orange|purple|gray|grey)$/u.test(value));
    else if (name === "fill-rule") insist(value === "nonzero" || value === "evenodd");
    else if (name === "stroke-linecap") insist(["butt", "round", "square"].includes(value));
    else if (name === "stroke-linejoin") insist(["miter", "round", "bevel"].includes(value));
    else if (name === "clipPathUnits") insist(value === "userSpaceOnUse");
    else if (name === "markerUnits") insist(value === "strokeWidth" || value === "userSpaceOnUse");
    else if (name === "orient") { const list = numbers(value, 1); insist(list[0] === 0); node.numbers++; }
    else if (name === "href" || name === "xlink:href") { insist(node.tag === "use" && value[0] === "#" && identifier(value.slice(1))); node.refs.push({ id: value.slice(1), kind: "use" }); }
    else if (name === "clip-path" || markerAttributes.has(name)) {
      const marker = markerAttributes.has(name); insist(!marker || markerShapes.has(node.tag));
      if (marker && value === "none") continue;
      const match = /^url\(#([A-Za-z_][A-Za-z0-9_.-]{0,95})\)$/u.exec(value); insist(!!match);
      node.refs.push({ id: match[1], kind: marker ? "marker" : "clip" });
    }
    else if (name === "d") node.numbers += pathNumbers(value);
    else if (name === "transform") { insist(!root && node.tag !== "marker"); const transform = transformNumbers(value); node.numbers += transform.numbers; node.matrix = transform.matrix; }
    else if (name === "points") { const list = numbers(value, CHILD_SVG_MAX_NUMBERS); insist(list.length >= 4 && list.length % 2 === 0); node.numbers += list.length; }
    else if (name === "stroke-dasharray") { if (value !== "none") { const list = numbers(value, 64); insist(list.every(number => number >= 0) && list.some(number => number > 0)); node.numbers += list.length; } }
    else if ((name === "width" || name === "height") && node.tag === "use" && value === "100%") { /* Canonical local geometry reference only. */ }
    else {
      const list = numbers(value, 1); insist(list.length === 1); node.numbers++;
      if (["width", "height", "r", "rx", "ry", "stroke-width", "stroke-miterlimit", "markerWidth", "markerHeight"].includes(name)) insist(list[0] >= 0);
      if (["opacity", "fill-opacity", "stroke-opacity"].includes(name)) insist(list[0] >= 0 && list[0] <= 1);
      if (name === "stroke-width") node.stroke = list[0];
    }
  }
  if (node.tag === "use") insist((attributes.href === undefined) !== (attributes["xlink:href"] === undefined));
  if (root) insist(attributes.xmlns === "http://www.w3.org/2000/svg" && attributes.viewBox !== undefined);
  if (node.tag === "marker") {
    const scalar = (key: string, fallback: number) => attributes[key] === undefined ? fallback : numbers(attributes[key], 1)[0];
    const width = scalar("markerWidth", 3), height = scalar("markerHeight", 3);
    insist(attributes.id !== undefined && Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= CHILD_SVG_MAX_DIMENSION
      && height <= CHILD_SVG_MAX_DIMENSION && width * height <= CHILD_SVG_MAX_PIXELS);
    node.marker = { width, height, refX: scalar("refX", 0), refY: scalar("refY", 0), strokeUnits: attributes.markerUnits !== "userSpaceOnUse" };
  }
  if (node.refs.some(ref => ref.kind === "marker")) node.vertices = markerVertices(node);
}
function parse(source: string): Parsed {
  insist(source.length > 0 && !/[&\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source));
  const nodes: Node[] = [], stack: number[] = [], ids = new Map<string, number>(); let at = 0, rootEnd = 0, rootSelf = false, numericCount = 0;
  const skip = () => { while (at < source.length && /[\t\n\r ]/u.test(source[at])) at++; };
  const name = () => { namePattern.lastIndex = at; const match = namePattern.exec(source); insist(!!match && match[0].length <= 96); at = namePattern.lastIndex; return match[0]; };
  while (at < source.length) {
    skip(); if (at === source.length) break; insist(source[at++] === "<");
    if (source[at] === "/") { at++; const tag = name(); skip(); insist(source[at++] === ">" && stack.length > 0 && nodes[stack.pop()!].tag === tag); continue; }
    const tag = name(); insist(tags.has(tag) && nodes.length < CHILD_SVG_MAX_NODES && (nodes.length === 0 ? tag === "svg" : stack.length > 0 && tag !== "svg"));
    if (stack.length) insist(containers.has(nodes[stack[stack.length - 1]].tag));
    // Definitions cannot be cloned under a use or a marker; this keeps their
    // lexical presentation inheritance distinct from each referring geometry.
    if (tag === "marker") insist(stack.length === 1 || stack.length === 2 && nodes[stack[1]].tag === "defs");
    const attributes: Record<string, string> = Object.create(null) as Record<string, string>; let attributeCount = 0, selfClosing = false;
    while (true) {
      const previous = at; skip();
      if (source[at] === ">") { at++; break; }
      if (source[at] === "/" && source[at + 1] === ">") { at += 2; selfClosing = true; break; }
      insist(at > previous && ++attributeCount <= CHILD_SVG_MAX_ATTRIBUTES); const key = name(); insist(attributes[key] === undefined); skip(); insist(source[at++] === "="); skip();
      const quote = source[at++]; insist(quote === '"' || quote === "'"); const end = source.indexOf(quote, at);
      insist(end >= at && end - at <= CHILD_SVG_MAX_ATTRIBUTE_LENGTH); const value = source.slice(at, end); insist(!/[<>&]/u.test(value)); attributes[key] = value; at = end + 1;
    }
    const node: Node = { tag, attributes, children: [], refs: [], numbers: 0, matrix: [1, 0, 0, 1, 0, 0], stroke: null,
      lexicalStroke: stack.length ? nodes[stack[stack.length - 1]].lexicalStroke : 1, vertices: [], marker: null };
    validate(node, nodes.length === 0); node.lexicalStroke = node.stroke ?? node.lexicalStroke;
    numericCount += node.numbers; insist(numericCount <= CHILD_SVG_MAX_NUMBERS);
    const index = nodes.length; nodes.push(node); if (stack.length) nodes[stack[stack.length - 1]].children.push(index);
    if (attributes.id !== undefined) { insist(!ids.has(attributes.id)); ids.set(attributes.id, index); }
    if (index === 0) { rootEnd = at; rootSelf = selfClosing; }
    if (!selfClosing) { insist(stack.length < CHILD_SVG_MAX_DEPTH); stack.push(index); }
  }
  insist(nodes.length > 0 && stack.length === 0);
  const root = nodes[0], viewBox = numbers(root.attributes.viewBox, 4);
  const width = Math.ceil(root.attributes.width === undefined ? viewBox[2] : numbers(root.attributes.width, 1)[0]);
  const height = Math.ceil(root.attributes.height === undefined ? viewBox[3] : numbers(root.attributes.height, 1)[0]);
  insist(width > 0 && height > 0 && width <= CHILD_SVG_MAX_DIMENSION && height <= CHILD_SVG_MAX_DIMENSION && width * height <= CHILD_SVG_MAX_PIXELS);
  const edges = nodes.map(node => node.children.map(target => ({ target, count: 1 })));
  nodes.forEach((node, index) => node.refs.forEach(ref => {
    const target = ids.get(ref.id); insist(target !== undefined && (ref.kind === "clip" ? nodes[target].tag === "clipPath"
      : ref.kind === "marker" ? nodes[target].tag === "marker" : !["svg", "defs", "clipPath", "marker"].includes(nodes[target].tag)));
    if (node.attributes["xlink:href"] !== undefined) insist(root.attributes["xmlns:xlink"] === "http://www.w3.org/1999/xlink");
    // Every marker property is conservatively charged at every vertex plus one.
    // Explicit close commands are included, even when they carry no parameters.
    edges[index].push({ target, count: ref.kind === "marker" ? node.vertices.length + 1 : 1 });
  }));
  const states = new Uint8Array(nodes.length), costs: { nodes: number; numbers: number; pixels: number; depth: number }[] = [];
  function cost(index: number, depth: number): { nodes: number; numbers: number; pixels: number; depth: number } {
    insist(depth <= CHILD_SVG_MAX_DEPTH && states[index] !== 1);
    if (states[index] === 2) { insist(depth + costs[index].depth - 1 <= CHILD_SVG_MAX_DEPTH); return costs[index]; } states[index] = 1;
    let count = 1, numeric = nodes[index].numbers, pixels = nodes[index].marker ? nodes[index].marker!.width * nodes[index].marker!.height : 0, height = 1;
    for (const edge of edges[index]) { const child = cost(edge.target, depth + 1); count += child.nodes * edge.count; numeric += child.numbers * edge.count; pixels += child.pixels * edge.count;
      height = Math.max(height, child.depth + 1); insist(count <= CHILD_SVG_MAX_EXPANDED_NODES && numeric <= CHILD_SVG_MAX_EXPANDED_NUMBERS
        && pixels <= CHILD_SVG_MAX_PIXELS && depth + height - 1 <= CHILD_SVG_MAX_DEPTH); }
    states[index] = 2; return costs[index] = { nodes: count, numbers: numeric, pixels, depth: height };
  }
  cost(0, 1);
  // SVG's default xMidYMid/meet root mapping is part of the resource budget.
  // Validate both viewport ratios conservatively before deriving that mapping.
  const sx = width / viewBox[2], sy = height / viewBox[3]; insist(Number.isFinite(sx) && Number.isFinite(sy) && sx <= COORDINATE && sy <= COORDINATE);
  const scale = Math.min(sx, sy), viewport = multiply([1, 0, 0, 1, 0, 0], [scale, 0, 0, scale,
    (width - viewBox[2] * scale) / 2 - viewBox[0] * scale, (height - viewBox[3] * scale) / 2 - viewBox[1] * scale]);
  let expanded = 0, markerPixels = 0;
  function mapping(index: number, inherited: Matrix, depth: number, inheritedStroke: number): void {
    insist(++expanded <= CHILD_SVG_MAX_EXPANDED_NODES && depth <= CHILD_SVG_MAX_DEPTH);
    const node = nodes[index], current = multiply(inherited, node.matrix), stroke = node.stroke ?? inheritedStroke;
    for (const child of node.children) mapping(child, current, depth + 1, stroke);
    for (const ref of node.refs) {
      const target = ids.get(ref.id)!;
      if (ref.kind === "marker") {
        const marker = nodes[target].marker!;
        for (const [x, y] of node.vertices) {
          const positioned = multiply(current, [1, 0, 0, 1, x, y]), scale = marker.strokeUnits ? stroke : 1;
          const sized = multiply(positioned, [scale, 0, 0, scale, 0, 0]);
          const placed = multiply(sized, [1, 0, 0, 1, -marker.refX, -marker.refY]);
          // The default hidden overflow clips to this viewport. Account for all
          // four corners as well as the transformed reference-point translation.
          const corners = [[0, 0], [marker.width, 0], [0, marker.height], [marker.width, marker.height]]
            .map(([vx, vy]) => multiply(placed, [1, 0, 0, 1, vx, vy]));
          const xs = corners.map(corner => corner[4]), ys = corners.map(corner => corner[5]);
          // In addition to the conservative DAG-local viewport pixel cost,
          // bound the sum of transformed viewport bounding boxes. This includes
          // inherited stroke scale, root mapping, skew and nested marker refs.
          markerPixels += Math.ceil(Math.max(...xs) - Math.min(...xs)) * Math.ceil(Math.max(...ys) - Math.min(...ys));
          insist(Number.isFinite(markerPixels) && markerPixels <= CHILD_SVG_MAX_PIXELS);
          mapping(target, placed, depth + 1, nodes[target].lexicalStroke);
        }
        continue;
      }
      const positioned = ref.kind === "use" ? multiply(current, [1, 0, 0, 1,
        node.attributes.x === undefined ? 0 : numbers(node.attributes.x, 1)[0], node.attributes.y === undefined ? 0 : numbers(node.attributes.y, 1)[0]]) : current;
      mapping(target, positioned, depth + 1, ref.kind === "clip" ? nodes[target].lexicalStroke : stroke);
    }
  }
  mapping(0, viewport, 1, 1); return { header: Object.freeze({ kind: "image", width, height }), source, rootEnd, selfClosing: rootSelf, nodes };
}
function owned(input: unknown): Uint8Array | null {
  if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype) return null;
  const prototype = Object.getPrototypeOf(Uint8Array.prototype), length: number = Object.getOwnPropertyDescriptor(prototype, "byteLength")!.get!.call(input);
  const offset: number = Object.getOwnPropertyDescriptor(prototype, "byteOffset")!.get!.call(input), buffer: ArrayBuffer = Object.getOwnPropertyDescriptor(prototype, "buffer")!.get!.call(input);
  if (length < 1 || length > CHILD_SVG_MAX_BYTES || !(buffer instanceof ArrayBuffer)
    || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get?.call(buffer) === true) return null;
  const copy = new Uint8Array(length); copy.set(new Uint8Array(buffer, offset, length)); return copy;
}
function decoded(bytes: Uint8Array): string {
  insist(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)); return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export function preflightChildStaticSvg(input: unknown): Header | null {
  let bytes: Uint8Array | null = null; try { bytes = owned(input); return bytes ? parse(decoded(bytes)).header : null; } catch { return null; } finally { bytes?.fill(0); }
}
/** Caller owns the returned UTF8 buffer and must wipe it. Only intrinsic root
 * dimensions are normalized for the native rasterizer; geometry is preserved.
 * Original reviewed inventory bytes/digests remain untouched and authoritative. */
export function createChildStaticSvgRasterBytes(input: unknown): Uint8Array | null {
  let bytes: Uint8Array | null = null;
  try {
    bytes = owned(input); if (!bytes) return null; const parsed = parse(decoded(bytes));
    const attributes = Object.entries(parsed.nodes[0].attributes).filter(([name]) => name !== "width" && name !== "height")
      .map(([name, value]) => `${name}="${value}"`).join(" ");
    const source = `<svg ${attributes} width="${parsed.header.width}" height="${parsed.header.height}"${parsed.selfClosing ? "/" : ""}>${parsed.source.slice(parsed.rootEnd)}`;
    const result = new TextEncoder().encode(source); if (result.length > CHILD_SVG_MAX_BYTES + 128) { result.fill(0); return null; } return result;
  } catch { return null; } finally { bytes?.fill(0); }
}

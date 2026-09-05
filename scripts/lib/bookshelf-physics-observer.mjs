// These observers live only in the audit page. No runtime hooks enter the site.
export function installObservers() {
  const roots = new Set();
  const contexts = new Map();
  let nextRenderer = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => ++nextRenderer,
    onCommitFiberRoot: (_id, root) => roots.add(root),
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  };
  for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!prototype) continue;
    for (const name of ["Texture", "Buffer", "Framebuffer", "Renderbuffer", "Program", "Shader", "VertexArray"]) {
      for (const operation of ["create", "delete"]) {
        const method = `${operation}${name}`;
        const original = prototype[method];
        if (!original || original.shelfAuditWrapped) continue;
        const wrapped = function (...args) {
          let stats = contexts.get(this);
          if (!stats) { stats = { canvas: this.canvas, resources: {}, draws: 0 }; contexts.set(this, stats); }
          const resources = stats.resources[name] ||= { created: 0, deleted: 0, live: new Set() };
          const result = original.apply(this, args);
          if (operation === "create" && result) { resources.created++; resources.live.add(result); }
          if (operation === "delete" && args[0] && resources.live.delete(args[0])) resources.deleted++;
          return result;
        };
        wrapped.shelfAuditWrapped = true;
        prototype[method] = wrapped;
      }
    }
    for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = prototype[method];
      if (!original || original.shelfAuditWrapped) continue;
      const wrapped = function (...args) {
        const stats = contexts.get(this);
        if (stats) stats.draws++;
        return original.apply(this, args);
      };
      wrapped.shelfAuditWrapped = true;
      prototype[method] = wrapped;
    }
  }
  function fibers(root) {
    const stack = [root.current], result = [];
    while (stack.length && result.length < 20000) {
      const node = stack.pop();
      if (!node) continue;
      result.push(node);
      if (node.sibling) stack.push(node.sibling);
      if (node.child) stack.push(node.child);
    }
    return result;
  }
  function sceneData() {
    for (const root of roots) {
      const nodes = fibers(root);
      const object = nodes.find((node) => node.stateNode?.isObject3D && node.stateNode.__r3f?.root)?.stateNode;
      const state = object?.__r3f.root.getState();
      if (!state?.gl.domElement.closest("#books")) continue;
      const books = nodes.filter((node) => node.memoizedProps?.layout?.spec).map((node) => {
        const group = fibers({ current: node.child }).find((child) => child.stateNode?.isGroup)?.stateNode;
        return { ...node.memoizedProps, group };
      }).filter((book) => book.group);
      const controller = nodes.find((node) => typeof node.memoizedProps?.detailOpen === "boolean" && "itemIndex" in node.memoizedProps)?.memoizedProps;
      return { state, books, controller };
    }
    return null;
  }
  function screenPoint(state, group, point) {
    const projected = group.position.clone().set(...point).applyMatrix4(group.matrixWorld).project(state.camera);
    const rect = state.gl.domElement.getBoundingClientRect();
    return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2, z: projected.z };
  }
  function read() {
    const data = sceneData();
    if (!data) return null;
    const { state, books, controller } = data;
    state.scene.updateMatrixWorld(); state.camera.updateMatrixWorld();
    const rect = state.gl.domElement.getBoundingClientRect();
    const stats = contexts.get(state.gl.getContext());
    const selected = books.find((book) => book.selectedBookKey === book.layout.spec.key);
    return {
      phase: document.querySelector(".book-shelf-scene")?.dataset.bookShelfPhase,
      selectedKey: selected?.layout.spec.key ?? null,
      selectedTitle: selected?.layout.spec.title ?? null,
      pageIndex: selected?.inspectionSession?.pageIndex ?? null,
      pageCount: selected?.inspectionSession?.pageCount ?? null,
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      camera: { position: state.camera.position.toArray(), fov: state.camera.fov },
      qualityProfile: books[0]?.qualitySettings?.profile,
      lightExposure: state.gl.toneMappingExposure,
      insets: controller?.viewportInsets ?? { top: 0, right: 0, bottom: 0, left: 0 },
      books: books.map((book) => {
        const spec = book.layout.spec;
        const point = screenPoint(state, book.group, [-spec.dimensions.coverWidth / 2 - 0.02, 0, 0]);
        return { key: spec.key, title: spec.title, sourceIndex: spec.sourceIndex, ...point };
      }).sort((a,b) => a.x - b.x),
      resources: Object.fromEntries(Object.entries(stats?.resources || {}).map(([name, value]) => [name, { created: value.created, deleted: value.deleted, live: value.live.size }])),
      draws: stats?.draws ?? 0,
      pendingFrames: state.internal.frames,
      renderer: { ...state.gl.info.memory, calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles },
    };
  }
  function footprint() {
    const data = sceneData();
    const selected = data?.books.find((book) => book.selectedBookKey === book.layout.spec.key);
    if (!selected) return null;
    const points = [];
    selected.group.traverse((object) => {
      if (!object.geometry || object.userData.spineHit || !object.isMesh) return;
      for (let parent = object; parent && parent !== selected.group.parent; parent = parent.parent) if (!parent.visible) return;
      object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      if (!box) return;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(screenPoint(data.state, object, [x,y,z]));
    });
    return { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)), right: Math.max(...points.map((p) => p.x)), bottom: Math.max(...points.map((p) => p.y)), points: points.length };
  }
  function pagePoint(u, v) {
    const data = sceneData();
    const selected = data?.books.find((book) => book.selectedBookKey === book.layout.spec.key);
    if (!selected) return null;
    const page = selected.group.children.find((object) => object.__r3f?.handlers?.onPointerDown && object !== selected.group);
    if (!page) return null;
    const dimensions = selected.layout.spec.dimensions;
    return screenPoint(data.state, page, [(dimensions.coverWidth - 0.109) * u, (dimensions.height - 0.082) * (v - 0.5), 0.002]);
  }
  function palettePatches() {
    const data = sceneData();
    if (!data) return [];
    const rect = data.state.gl.domElement.getBoundingClientRect();
    return data.books.map((book) => {
      const { spec } = book.layout;
      const project = (y, z) => screenPoint(data.state, book.group, [-spec.dimensions.coverWidth / 2 - 0.025, y, z]);
      const top = project(spec.dimensions.height / 2, 0), bottom = project(-spec.dimensions.height / 2, 0);
      const half = (spec.dimensions.pageDepth + spec.dimensions.boardThickness * 2) / 2;
      const left = project(0, -half), right = project(0, half);
      return { key: spec.key, slot: spec.paletteSlot, baseColor: spec.baseColor,
        x: Math.min(left.x, right.x) - rect.x, width: Math.abs(right.x - left.x), y: top.y - rect.y, height: bottom.y - top.y };
    });
  }
  window.__shelfAudit = { read, footprint, pagePoint, palettePatches, sceneData };
}

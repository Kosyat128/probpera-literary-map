import { _roots } from "@react-three/fiber";

/** Explicit loopback QA builds only; no state mutation or production export. */
export function installPwaSceneProbe(target: Window) {
  if (!__LITERARY_PLANET_LOCAL_QA__ || !["127.0.0.1", "localhost", "[::1]"].includes(target.location.hostname)) return;
  Object.defineProperty(target, "__literaryPlanetQaScenes", {
    configurable: true,
    value: () => [..._roots.entries()].map(([canvas, root]) => {
      const state = root.store.getState();
      return Object.freeze({ canvas, renderer: state.gl, camera: state.camera, scene: state.scene });
    }),
  });
}

import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Mesh, Object3D, Sphere, Vector3 } from "three";
import type { GlobeSceneInspectionBridge } from "../host/planetSceneInspectionBridge";

/** A DOM action follows actual geometry. Decorative meshes keep raycast disabled. */
export default function GlobeSceneInspectionAnchor({ bridge, resourceKey, target, ready, globeRef }: {
  bridge: GlobeSceneInspectionBridge;
  resourceKey: object;
  target: Object3D;
  ready: () => boolean;
  globeRef: RefObject<Mesh>;
}) {
  const { camera, gl, invalidate } = useThree();
  const latestReady = useRef(ready);
  useLayoutEffect(() => { latestReady.current = ready; }, [ready]);
  const vectors = useMemo(() => ({ box: new Box3(), world: new Vector3(), projected: new Vector3(),
    eye: new Vector3(), direction: new Vector3(), closest: new Vector3(), sphere: new Sphere() }), []);
  useLayoutEffect(() => {
    const release = bridge.controller.registerTarget(resourceKey, {
      backgroundId: "background.base.writer-study", canActivate: () => latestReady.current(),
    });
    return () => {
      const marker = bridge.markerRef.current;
      if (marker) marker.style.visibility = "hidden";
      release();
    };
  }, [bridge.controller, bridge.markerRef, resourceKey, target]);

  useLayoutEffect(() => {
    const update = () => {
      const snapshot = bridge.controller.getSnapshot();
      if (snapshot.mode !== "scene" || !snapshot.available) {
        const marker = bridge.markerRef.current;
        if (marker) {
          marker.style.visibility = "hidden";
          marker.dataset.projectedVisible = "false";
        }
      }
      // This component has no Three host props to invalidate a demand frame.
      // Readiness can also change after rendering, once the room is acknowledged.
      // The controller publishes only changed snapshots, not every refreshTarget.
      invalidate();
    };
    const unsubscribe = bridge.controller.subscribe(update);
    update();
    return unsubscribe;
  }, [bridge.controller, bridge.markerRef, resourceKey, target, invalidate]);

  useFrame(() => {
    bridge.controller.refreshTarget();
    const marker = bridge.markerRef.current;
    if (!marker) return;
    const snapshot = bridge.controller.getSnapshot();
    let visible = snapshot.mode === "scene" && snapshot.available && latestReady.current();
    if (visible) {
      const { box, world, projected, eye, direction, closest, sphere } = vectors;
      box.setFromObject(target); box.getCenter(world); world.y = box.max.y + .06;
      projected.copy(world).project(camera);
      visible = [projected.x, projected.y, projected.z].every(Number.isFinite)
        && projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) < .96 && Math.abs(projected.y) < .93;
      // Never place a manuscript action over the actual globe surface.
      const globe = globeRef.current;
      if (visible && globe) {
        if (!globe.geometry.boundingSphere) globe.geometry.computeBoundingSphere();
        if (globe.geometry.boundingSphere) {
          sphere.copy(globe.geometry.boundingSphere).applyMatrix4(globe.matrixWorld);
          sphere.radius *= 1.10;
          camera.getWorldPosition(eye); direction.subVectors(world, eye);
          const lengthSquared = direction.lengthSq();
          const fraction = lengthSquared > 0 ? closest.subVectors(sphere.center, eye).dot(direction) / lengthSquared : 0;
          closest.copy(eye).addScaledVector(direction, Math.max(0, Math.min(1, fraction)));
          if (fraction > 0 && fraction < 1 && closest.distanceToSquared(sphere.center) <= sphere.radius ** 2) visible = false;
        }
      }
      if (visible) {
        const canvas = gl.domElement.getBoundingClientRect();
        const parent = marker.offsetParent;
        if (!(parent instanceof HTMLElement)) visible = false;
        else {
          const bounds = parent.getBoundingClientRect();
          const x = canvas.left - bounds.left - parent.clientLeft + parent.scrollLeft + (projected.x + 1) * canvas.width / 2;
          const y = canvas.top - bounds.top - parent.clientTop + parent.scrollTop + (1 - projected.y) * canvas.height / 2;
          marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        }
      }
    }
    marker.style.visibility = visible ? "visible" : "hidden";
    marker.dataset.projectedVisible = String(visible);
  });
  return null;
}

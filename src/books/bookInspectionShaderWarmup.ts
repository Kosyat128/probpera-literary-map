import type { Camera, Object3D, Scene, WebGLRenderer } from "three";

/** Submit the same hidden rig, then await driver completion without a draw. */
export function warmBookInspectionShaders(
  renderer: WebGLRenderer,
  rig: Object3D,
  camera: Camera,
  scene: Scene,
  onReady: () => void,
  onFailure: (error: unknown) => void,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let programs: NonNullable<WebGLRenderer["info"]["programs"]> = [];
  const context = renderer.getContext();
  const extension = context.getExtension("KHR_parallel_shader_compile");
  const startedAt = performance.now();
  try {
    // Like compileAsync, compile traverses hidden meshes without onFirstUse.
    // Own the polling so unmount/context loss cannot retain disposed materials.
    renderer.compile(rig, camera, scene);
    programs = [...(renderer.info.programs || [])];
    const check = () => {
      if (cancelled) return;
      if (context.isContextLost()) {
        onFailure(new Error("Inspection shader context lost"));
        return;
      }
      if (!extension || programs.every(program => !program.program || context.getProgramParameter(program.program, extension.COMPLETION_STATUS_KHR))) {
        // A page map can replace a material while other programs are pending.
        // Ignore destroyed handles, then release attached shaders even for a
        // compiled variant that will not be drawn (Three does this on first use).
        for (const program of programs) if (program.program) program.getUniforms();
        onReady();
        return;
      }
      if (performance.now() - startedAt > 20_000) {
        onFailure(new Error("Inspection shader preparation timed out"));
        return;
      }
      timer = setTimeout(check, 16);
    };
    timer = setTimeout(check, 0);
  } catch (error) {
    timer = setTimeout(() => { if (!cancelled) onFailure(error); }, 0);
  }
  return () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer);
    // Deleted programs do not release never-used shaders in Three. Mark them
    // for deletion while attached; WebGL retains them until their link detaches.
    for (const program of programs) {
      for (const shader of [program.vertexShader, program.fragmentShader]) {
        if (context.isShader(shader) && !context.getShaderParameter(shader, context.DELETE_STATUS)) context.deleteShader(shader);
      }
    }
  };
}

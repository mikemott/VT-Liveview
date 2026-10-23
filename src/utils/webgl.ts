/**
 * WebGL capability detection.
 *
 * MapLibre needs WebGL. Some browsers have it disabled (enterprise policy,
 * blocklisted GPU drivers, privacy hardening, remote desktops), and in that
 * case `new maplibregl.Map()` throws. We check up front so the app can show a
 * useful fallback instead of the generic error boundary.
 */
export function isWebGLSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // Release the probe context right away; browsers cap live contexts.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

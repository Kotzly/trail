/**
 * REMOVES dynamic code generation (eval / Function constructor) from PixiJS
 * shader compilation.
 *
 * Despite the misleading path name "unsafe-eval", this import does the opposite:
 * it replaces PixiJS's default dynamic shader compilation with static code paths,
 * eliminating the need for `unsafe-eval` in the Content Security Policy.
 *
 * After this import, PixiJS compiles shaders via pre-built static functions only,
 * making the WebGL renderer fully compatible with Manifest V3 strict CSP
 * (which forbids eval and similar dynamic code generation).
 *
 * Keep this import isolated from app bootstrap to avoid leaking the vendor path.
 * See extension/CSP-RATIONALE.md for the full CWS reviewer explanation.
 */
import "pixi.js/unsafe-eval";

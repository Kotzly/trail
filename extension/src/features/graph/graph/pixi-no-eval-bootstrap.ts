/**
 * Installs Pixi's no-eval polyfills so the renderer stays CSP-safe in MV3.
 * Keep this import isolated from app bootstrap to avoid leaking the vendor path.
 */
import "pixi.js/unsafe-eval";

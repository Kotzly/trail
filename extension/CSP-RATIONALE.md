# CSP Rationale for Chrome Web Store Review

## Summary

This extension uses the **Manifest V3 default strict Content Security Policy**.
No `unsafe-eval` or `unsafe-inline` directives are declared in the manifest.

## PixiJS Usage

Trail uses **PixiJS 8.x** for 2D WebGL tree visualization (browsing history
rendered as an interactive node graph in the sidepanel and fullview).

By default, PixiJS compiles GPU shaders at runtime using dynamic code generation
(`eval` / `Function` constructor). This is incompatible with MV3's strict CSP.

## How We Resolve It

PixiJS ships an official polyfill at `pixi.js/unsafe-eval` that **replaces**
dynamic shader compilation with pre-built static code paths. Despite the
confusing path name, this import *removes* the need for `unsafe-eval` rather
than adding it.

The import lives in a single file:

```
src/features/graph/graph/pixi-no-eval-bootstrap.ts
```

This file is loaded before any PixiJS rendering occurs, ensuring all shader
compilation uses static paths from the start.

## Conclusion

- No CSP exceptions are required.
- No `unsafe-eval` or `unsafe-inline` directives appear in the manifest.
- The extension operates under Manifest V3 default strict CSP.

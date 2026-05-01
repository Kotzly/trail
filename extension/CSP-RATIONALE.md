# CSP Rationale for Chrome Web Store Review

## Summary

This extension uses the **Manifest V3 default strict Content Security Policy**.
No `unsafe-eval` or `unsafe-inline` directives are declared in the manifest.

## Rendering Stack

Trail renders its navigation tree with:

- **React 19** (JSX compiled ahead of time by esbuild)
- **@xyflow/react** (React Flow) for the graph canvas
- **d3-hierarchy** for layout (pure JS, no runtime code generation)

No WebGL, WASM, shader compilation, or dynamic function evaluation is used at
runtime. No third-party script tags. All application code ships as static JS
bundles produced by WXT/Vite.

## Conclusion

- No CSP exceptions are required.
- No `unsafe-eval` or `unsafe-inline` directives appear in the manifest.
- The extension operates under Manifest V3 default strict CSP.

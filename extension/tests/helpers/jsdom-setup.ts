/**
 * jsdom bootstrap for React hook tests.
 *
 * Import this file BEFORE any module that touches `document`,
 * `requestAnimationFrame`, or React Testing Library. It installs
 * a minimal browser-like global environment so RTL's `renderHook`
 * + React 19 commit phase can run under plain `node --import tsx`.
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;

g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.location = dom.window.location;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLDivElement = dom.window.HTMLDivElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.SVGElement = dom.window.SVGElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.NodeList = dom.window.NodeList;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
g.CustomEvent = dom.window.CustomEvent;
g.DOMException = dom.window.DOMException;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

if (typeof g.matchMedia !== "function") {
  g.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// React 19 looks at this flag to decide whether to use the modern
// `act`. Without it RTL warns about updates outside act and the
// concurrent reconciler short-circuits.
g.IS_REACT_ACT_ENVIRONMENT = true;

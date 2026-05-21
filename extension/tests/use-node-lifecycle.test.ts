/**
 * Behavioural contract for `useNodeLifecycle`.
 *
 * The hook is a critical-path piece of the graph render loop with no
 * existing coverage. This suite locks down the externally-observable
 * behaviour so the upcoming refactor (impure useMemo → useLayoutEffect)
 * can be verified diff-by-diff against the same expectations.
 *
 * Cases:
 *   - bootstrap: very first non-empty cohort is NOT marked as entering
 *   - enter: new node arriving after a non-empty cohort → entering class
 *   - exit: removed node renders as a ghost with exiting class, marked
 *     non-interactive
 *   - return: exit → re-enter within the return window → returning class
 *   - gate-off: enabled=false → original node refs pass through unchanged
 *   - stagger: 3+ simultaneous entries → animationDelay cascades 0/30/60ms
 */

import "./helpers/jsdom-setup.js";

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { renderHook, cleanup, act } from "@testing-library/react";

import { useNodeLifecycle } from "../src/features/graph/motion/useNodeLifecycle.js";
import type { TrailNode, TrailNodeData } from "../src/features/graph/types.js";
import type { NodeId, Url, Title } from "../src/shared/types/ids.js";

function makeNode(id: string): TrailNode {
  const data: TrailNodeData = {
    nodeId: id as NodeId,
    url: `https://example.com/${id}` as Url,
    title: `Node ${id}` as Title,
    pinned: false,
    isCurrent: false,
    isOpen: false,
    onActivePath: false,
    tabCount: 0,
    childCount: 0,
    isCollapsed: false,
    wasExpandedViaBadge: false,
    foldedAncestorCount: 0,
    isChainUnfolded: false,
    handles: ["target-top", "source-bottom"],
    isRenaming: false,
  };
  return {
    id,
    type: "trail",
    position: { x: 0, y: 0 },
    data,
  };
}

function render(initial: { nodes: readonly TrailNode[]; enabled: boolean }) {
  return renderHook(
    ({ nodes, enabled }: { nodes: readonly TrailNode[]; enabled: boolean }) =>
      useNodeLifecycle(nodes, enabled),
    { initialProps: initial },
  );
}

describe("useNodeLifecycle", () => {
  after(() => cleanup());

  it("bootstrap: first non-empty cohort passes through without enter class", () => {
    const a = makeNode("a");
    const b = makeNode("b");
    const { result } = render({ nodes: [a, b], enabled: true });
    assert.equal(result.current.length, 2);
    // Same refs — no clone, no class.
    assert.equal(result.current[0], a);
    assert.equal(result.current[1], b);
  });

  it("enter: newcomer after non-empty cohort gets entering class", () => {
    const a = makeNode("a");
    const b = makeNode("b");
    const { result, rerender } = render({ nodes: [a], enabled: true });
    rerender({ nodes: [a, b], enabled: true });

    const stillA = result.current.find((n) => n.id === "a");
    assert.equal(stillA, a, "untouched node should keep its ref");

    const newcomer = result.current.find((n) => n.id === "b");
    assert.ok(newcomer, "b should appear in output");
    assert.match(String(newcomer.className ?? ""), /graph-node--entering/);
  });

  it("exit: removed node renders as ghost with exiting class + non-interactive", () => {
    const a = makeNode("a");
    const b = makeNode("b");
    const { result, rerender } = render({ nodes: [a, b], enabled: true });
    rerender({ nodes: [a], enabled: true });

    assert.equal(result.current.length, 2, "ghost held for animation");
    const ghost = result.current.find((n) => n.id === "b");
    assert.ok(ghost, "b should still appear as a ghost");
    assert.match(String(ghost.className ?? ""), /graph-node--exiting/);
    assert.equal(ghost.selectable, false);
    assert.equal(ghost.draggable, false);
  });

  it("return: ghost → re-enter within window gets returning class", () => {
    const a = makeNode("a");
    const b1 = makeNode("b");
    const b2 = makeNode("b");
    const { result, rerender } = render({ nodes: [a, b1], enabled: true });
    rerender({ nodes: [a], enabled: true });
    rerender({ nodes: [a, b2], enabled: true });

    const returnee = result.current.find((n) => n.id === "b");
    assert.ok(returnee, "b should reappear");
    assert.match(String(returnee.className ?? ""), /graph-node--returning/);
  });

  it("gate-off: nodes pass through unchanged when enabled=false", () => {
    const a = makeNode("a");
    const b = makeNode("b");
    const { result, rerender } = render({ nodes: [a], enabled: false });
    rerender({ nodes: [a, b], enabled: false });

    assert.equal(result.current.length, 2);
    assert.equal(result.current[0], a);
    assert.equal(result.current[1], b);
    assert.equal(result.current[1].className, undefined);
  });

  it("stagger: 3+ entries get progressive animationDelay", () => {
    const seed = makeNode("seed");
    const a = makeNode("a");
    const b = makeNode("b");
    const c = makeNode("c");
    const { result, rerender } = render({ nodes: [seed], enabled: true });
    rerender({ nodes: [seed, a, b, c], enabled: true });

    const entries = ["a", "b", "c"].map(
      (id) => result.current.find((n) => n.id === id)!,
    );
    for (const entry of entries) {
      assert.match(String(entry.className ?? ""), /graph-node--entering/);
    }
    // Order matches input order → stagger 0/30/60ms.
    const delays = entries.map((n) => (n.style as { animationDelay?: string }).animationDelay);
    assert.deepEqual(delays, ["0ms", "30ms", "60ms"]);
  });

  it("gate flip on after a paint clears bookkeeping (no spurious enters)", async () => {
    const a = makeNode("a");
    const b = makeNode("b");
    const { result, rerender } = render({ nodes: [a], enabled: false });

    // Add b while disabled — should pass through unmodified.
    await act(async () => {
      rerender({ nodes: [a, b], enabled: false });
    });
    assert.equal(result.current[1], b, "disabled: pass-through");

    // Flip enabled on with the same cohort — no new arrival relative
    // to the seed snapshot the hook just took.
    await act(async () => {
      rerender({ nodes: [a, b], enabled: true });
    });
    assert.equal(result.current.length, 2);
    for (const n of result.current) {
      assert.equal(n.className, undefined, "no enter class on gate-flip");
    }
  });
});

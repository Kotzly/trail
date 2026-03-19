import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { NodePosition } from "../../graph/types.js";
import type { ParticleRenderModel } from "../../graph/render/types.js";
import type {
  NodeAnimationState,
  OpenAnimationState,
  ParticleState,
} from "./graph-canvas-types.js";
import {
  createAnimationSpec,
  easeOutCubic,
  getAnimationProgress,
  lerp,
} from "../../graph/animation-utils.js";

export const BASE_MOTION = createAnimationSpec(150);
export const FAST_MOTION = createAnimationSpec(Math.max(60, Math.round(BASE_MOTION.duration / 2)));
export const OPEN_ANIMATION_DURATION = 240;

type UseGraphAnimationParams = {
  nodeWidth: number;
  nodeHeight: number;
  onTickRender?: () => void;
};

export function useGraphAnimation({
  nodeWidth,
  nodeHeight,
  onTickRender,
}: UseGraphAnimationParams) {
  const onTickRenderRef = useRef(onTickRender);
  onTickRenderRef.current = onTickRender;

  const animationStatesRef = useRef<Map<NodeId, NodeAnimationState>>(new Map());
  const openAnimationStatesRef = useRef<Map<NodeId, OpenAnimationState>>(new Map());
  const openProgressRef = useRef<Map<NodeId, number>>(new Map());
  const animatedPositionsRef = useRef<Map<NodeId, { x: number; y: number }>>(new Map());
  const exitNodesRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const prevPositionsRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const exitParticleTimeoutsRef = useRef<Map<NodeId, number>>(new Map());
  const particleAnimationsRef = useRef<ParticleState[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastAnimationTimeRef = useRef<number | null>(null);
  const animationNowRef = useRef<number | null>(null);
  const prevOpenNodesRef = useRef<Set<NodeId>>(new Set());
  const previousSiblingOrderRef = useRef<Map<string, NodeId[]>>(new Map());
  const mindmapSideRef = useRef<Map<NodeId, "left" | "right">>(new Map());
  const lastCollapseVersionRef = useRef<number>(-1);

  const [animationVersion, setAnimationVersion] = useState(0);
  const [particleVersion, setParticleVersion] = useState(0);

  const animationDuration = BASE_MOTION.duration;
  const animationStagger = BASE_MOTION.stagger;

  const invalidateAnimation = useCallback(() => {
    setAnimationVersion((v) => v + 1);
  }, []);

  const invalidateParticles = useCallback(() => {
    setParticleVersion((v) => v + 1);
  }, []);

  const animateTick = useCallback(
    function animateTick(time: number) {
      const deltaTime =
        lastAnimationTimeRef.current === null ? 16 : time - lastAnimationTimeRef.current;
      lastAnimationTimeRef.current = time;
      animationNowRef.current = time;
      const states = animationStatesRef.current;
      const entries = Array.from(states.entries());
      let nodesDirty = false;
      entries.forEach(([id, state]) => {
        const progress = getAnimationProgress(time, state.startTime, state.duration);
        if (progress.pending) {
          nodesDirty = true;
          return;
        }
        const x = lerp(state.startX, state.endX, progress.eased);
        const y = lerp(state.startY, state.endY, progress.eased);
        animatedPositionsRef.current.set(id, { x, y });
        nodesDirty = true;
        if (progress.done) {
          states.delete(id);
          animatedPositionsRef.current.delete(id);
          if (state.type === "exit") {
            exitNodesRef.current.delete(id);
          }
        }
      });
      const openStates = openAnimationStatesRef.current;
      let openDirty = false;
      if (openStates.size > 0) {
        openStates.forEach((state, id) => {
          const progress = getAnimationProgress(time, state.startTime, state.duration);
          if (progress.pending) {
            openDirty = true;
            return;
          }
          const value = lerp(state.from, state.to, progress.eased);
          openProgressRef.current.set(id, value);
          openDirty = true;
          if (progress.done) {
            openStates.delete(id);
          }
        });
      }
      const tickRender = onTickRenderRef.current;
      if (nodesDirty || openDirty) {
        if (tickRender) {
          tickRender();
        } else {
          invalidateAnimation();
        }
      }
      const particles = particleAnimationsRef.current;
      let particlesDirty = false;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i]!;
        particle.age += deltaTime;
        particlesDirty = true;
        if (particle.age >= particle.life) {
          particles.splice(i, 1);
          particlesDirty = true;
        }
      }
      if (particlesDirty) {
        if (tickRender) {
          // Only call tickRender for particles if we haven't already called it for nodes
          if (!nodesDirty && !openDirty) tickRender();
        } else {
          invalidateParticles();
        }
      }
      const needsLoop = states.size > 0 || particles.length > 0 || openStates.size > 0;
      if (needsLoop) {
        animationFrameRef.current = window.requestAnimationFrame(animateTick);
      } else {
        // Animation ended — reconcile React state once
        invalidateAnimation();
        invalidateParticles();
        animationFrameRef.current = null;
        lastAnimationTimeRef.current = null;
        animationNowRef.current = null;
      }
    },
    [invalidateAnimation, invalidateParticles],
  );

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(animateTick);
  }, [animateTick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lastAnimationTimeRef.current = null;
        animationNowRef.current = null;
      }
      exitParticleTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      exitParticleTimeoutsRef.current.clear();
    };
  }, []);

  const spawnExitParticles = useCallback(
    (pos: NodePosition) => {
      const centerX = pos.x + nodeWidth / 2;
      const centerY = pos.y + nodeHeight / 2;
      const particles = particleAnimationsRef.current;
      const count = 8;
      const now = performance.now();
      const baseDist = Math.max(nodeWidth, nodeHeight);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const distance = baseDist * (0.5 + Math.random() * 0.8);
        particles.push({
          id: `${pos.node.id}-exit-${now}-${i}`,
          startX: centerX,
          startY: centerY,
          endX: centerX + Math.cos(angle) * distance,
          endY: centerY + Math.sin(angle) * distance,
          life: animationDuration,
          age: 0,
          radius: Math.random() * 3 + 1.5,
        });
      }
      invalidateParticles();
      startAnimationLoop();
    },
    [animationDuration, invalidateParticles, nodeHeight, nodeWidth, startAnimationLoop],
  );

  const queueNodeAnimation = useCallback(
    (state: NodeAnimationState) => {
      animationStatesRef.current.set(state.id, state);
      animatedPositionsRef.current.set(state.id, { x: state.startX, y: state.startY });
      invalidateAnimation();
      startAnimationLoop();
    },
    [invalidateAnimation, startAnimationLoop],
  );

  const startEnter = useCallback(
    (
      pos: NodePosition,
      startCenter: { x: number; y: number },
      delayMs = 0,
      durationMs = animationDuration,
    ) => {
      const id = pos.node.id;
      animationStatesRef.current.delete(id);
      exitNodesRef.current.delete(id);
      const startX = startCenter.x - nodeWidth / 2;
      const startY = startCenter.y - nodeHeight / 2;
      const state: NodeAnimationState = {
        id,
        type: "enter",
        startX,
        startY,
        endX: pos.x,
        endY: pos.y,
        startTime: performance.now() + delayMs,
        duration: durationMs,
      };
      queueNodeAnimation(state);
    },
    [animationDuration, nodeHeight, nodeWidth, queueNodeAnimation],
  );

  const startExit = useCallback(
    (
      pos: NodePosition,
      endCenter: { x: number; y: number },
      delayMs = 0,
      durationMs = animationDuration,
      options: { spawnParticles?: boolean } = {},
    ) => {
      const id = pos.node.id;
      if (exitNodesRef.current.has(id)) return;
      animationStatesRef.current.delete(id);
      const startX = pos.x;
      const startY = pos.y;
      const endX = endCenter.x - nodeWidth / 2;
      const endY = endCenter.y - nodeHeight / 2;
      const state: NodeAnimationState = {
        id,
        type: "exit",
        startX,
        startY,
        endX,
        endY,
        startTime: performance.now() + delayMs,
        duration: durationMs,
      };
      queueNodeAnimation(state);
      exitNodesRef.current.set(id, { ...pos });
      const shouldSpawnParticles = options.spawnParticles !== false;
      const existingTimeout = exitParticleTimeoutsRef.current.get(id);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
        exitParticleTimeoutsRef.current.delete(id);
      }
      if (!shouldSpawnParticles) {
        return;
      }
      if (delayMs <= 0) {
        spawnExitParticles(pos);
      } else {
        const timeoutId = window.setTimeout(() => {
          exitParticleTimeoutsRef.current.delete(id);
          spawnExitParticles(pos);
        }, delayMs);
        exitParticleTimeoutsRef.current.set(id, timeoutId);
      }
    },
    [animationDuration, nodeHeight, nodeWidth, queueNodeAnimation, spawnExitParticles],
  );

  const startMove = useCallback(
    (
      id: NodeId,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      durationMs = animationDuration,
    ) => {
      animationStatesRef.current.delete(id);
      const state: NodeAnimationState = {
        id,
        type: "move",
        startX: fromX,
        startY: fromY,
        endX: toX,
        endY: toY,
        startTime: performance.now(),
        duration: durationMs,
      };
      queueNodeAnimation(state);
    },
    [animationDuration, queueNodeAnimation],
  );

  const particleRenderModels = (() => {
    return particleAnimationsRef.current.map((particle): ParticleRenderModel => {
      const progress = Math.min(1, particle.age / particle.life);
      const eased = easeOutCubic(progress);
      const alpha = Math.max(0, 1 - progress);
      return {
        id: particle.id,
        x: lerp(particle.startX, particle.endX, eased),
        y: lerp(particle.startY, particle.endY, eased),
        radius: particle.radius,
        alpha,
      };
    });
  })();

  return {
    // State versions (trigger re-renders)
    animationVersion,
    particleVersion,
    // Refs (read by other hooks/effects)
    particleAnimationsRef,
    animationStatesRef,
    openAnimationStatesRef,
    openProgressRef,
    animatedPositionsRef,
    exitNodesRef,
    prevPositionsRef,
    exitParticleTimeoutsRef,
    animationNowRef,
    prevOpenNodesRef,
    previousSiblingOrderRef,
    mindmapSideRef,
    lastCollapseVersionRef,
    // Functions
    invalidateAnimation,
    startAnimationLoop,
    startEnter,
    startExit,
    startMove,
    // Derived data
    particleRenderModels,
    // Constants
    animationDuration,
    animationStagger,
    openAnimationDuration: OPEN_ANIMATION_DURATION,
  };
}

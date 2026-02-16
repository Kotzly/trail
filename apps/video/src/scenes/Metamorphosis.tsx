import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { LuminousNode } from "../components/LuminousNode";
import { LightTrailEdge } from "../components/LightTrailEdge";
import { GhostTrail } from "../components/GhostTrail";
import { TrackedText } from "../components/TrackedText";
import { WhisperText } from "../components/WhisperText";
import { theme } from "../theme";
import {
  treeLayout,
  radialLayout,
  mindmapLayout,
  interpolatePositions,
  type TreeNode,
  type Position,
} from "../lib/layout";
import { SPRING_SMOOTH } from "../lib/springs";

const CX = 960;
const CY = 480;

/**
 * The same tree structure from the Capture scene,
 * simplified for layout calculations.
 */
const treeData: TreeNode[] = [
  { id: "root", label: "Search", children: ["n1", "n4"] },
  { id: "n1", label: "competitive analysis", children: ["n2", "n3"] },
  { id: "n2", label: "market overview", children: ["n8"] },
  { id: "n3", label: "competitor matrix", children: ["n7"] },
  { id: "n4", label: "AI market", children: ["n5", "n6"] },
  { id: "n5", label: "funding rounds", children: ["n10"] },
  { id: "n6", label: "key players", children: [] },
  { id: "n7", label: "arxiv paper", children: ["n9"] },
  { id: "n8", label: "methodology", children: ["n14"] },
  { id: "n9", label: "results", children: [] },
  { id: "n10", label: "openai/research", children: ["n11", "n12", "n13"] },
  { id: "n11", label: "readme", children: [] },
  { id: "n12", label: "benchmarks", children: [] },
  { id: "n13", label: "citations", children: [] },
  { id: "n14", label: "related work", children: [] },
];

const treePositions = treeLayout(treeData, "root", CX, CY);
const radialPositions = radialLayout(treeData, "root", CX, CY);
const mindmapPositions = mindmapLayout(treeData, "root", CX, CY);

const MORPH_1_START = 90;
const MORPH_1_END = 130;
const MORPH_2_START = 210;
const MORPH_2_END = 250;

function getEdgesForTree(data: TreeNode[]): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  for (const node of data) {
    for (const child of node.children) {
      edges.push({ from: node.id, to: child });
    }
  }
  return edges;
}

const edges = getEdgesForTree(treeData);

/**
 * Scene 5: Metamorphosis (frames 0-360 local, 900-1260 globally)
 * The tree morphs between three layout modes with ghost trails.
 */
export const Metamorphosis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Compute morph progress for each transition
  const morph1 = spring({
    frame: Math.max(0, frame - MORPH_1_START),
    fps,
    config: SPRING_SMOOTH,
  });

  const morph2 = spring({
    frame: Math.max(0, frame - MORPH_2_START),
    fps,
    config: SPRING_SMOOTH,
  });

  // Determine current positions
  let currentPositions: Map<string, Position>;

  if (frame < MORPH_1_START) {
    currentPositions = treePositions;
  } else if (frame < MORPH_2_START) {
    currentPositions = interpolatePositions(treePositions, radialPositions, morph1);
  } else {
    currentPositions = interpolatePositions(radialPositions, mindmapPositions, morph2);
  }

  // Ghost trails: compute previous frame positions for the active morph
  const ghostPositions: Map<string, Array<{ x: number; y: number }>> = new Map();
  if (frame >= MORPH_1_START && frame < MORPH_1_END + 15) {
    for (const node of treeData) {
      const ghosts: Array<{ x: number; y: number }> = [];
      for (let pastFrame = Math.max(MORPH_1_START, frame - 10); pastFrame < frame; pastFrame += 2) {
        const pastMorph = spring({
          frame: Math.max(0, pastFrame - MORPH_1_START),
          fps,
          config: SPRING_SMOOTH,
        });
        const pos = interpolatePositions(treePositions, radialPositions, pastMorph);
        const p = pos.get(node.id);
        if (p) ghosts.push(p);
      }
      ghostPositions.set(node.id, ghosts);
    }
  }
  if (frame >= MORPH_2_START && frame < MORPH_2_END + 15) {
    for (const node of treeData) {
      const ghosts: Array<{ x: number; y: number }> = [];
      for (let pastFrame = Math.max(MORPH_2_START, frame - 10); pastFrame < frame; pastFrame += 2) {
        const pastMorph = spring({
          frame: Math.max(0, pastFrame - MORPH_2_START),
          fps,
          config: SPRING_SMOOTH,
        });
        const pos = interpolatePositions(radialPositions, mindmapPositions, pastMorph);
        const p = pos.get(node.id);
        if (p) ghosts.push(p);
      }
      ghostPositions.set(node.id, ghosts);
    }
  }

  // Layout label
  let label = "TREE";
  if (frame >= MORPH_1_START + 20 && frame < MORPH_2_START + 20) label = "RADIAL";
  if (frame >= MORPH_2_START + 20) label = "MINDMAP";

  const labelOpacity = interpolate(
    frame,
    [0, 10],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const whisperEnter = 300;

  return (
    <VoidBackground>
      {/* Ghost trails */}
      {treeData.map((node) => {
        const ghosts = ghostPositions.get(node.id);
        if (!ghosts || ghosts.length === 0) return null;
        return <GhostTrail key={`ghost-${node.id}`} positions={ghosts} radius={4} />;
      })}

      {/* Edges */}
      {edges.map((edge) => {
        const fromPos = currentPositions.get(edge.from);
        const toPos = currentPositions.get(edge.to);
        if (!fromPos || !toPos) return null;
        return (
          <LightTrailEdge
            key={`edge-${edge.from}-${edge.to}`}
            x1={fromPos.x}
            y1={fromPos.y}
            x2={toPos.x}
            y2={toPos.y}
            enterFrame={0}
            drawDuration={1}
            lit
          />
        );
      })}

      {/* Nodes */}
      {treeData.map((node) => {
        const pos = currentPositions.get(node.id);
        if (!pos) return null;
        return (
          <LuminousNode
            key={node.id}
            x={pos.x}
            y={pos.y}
            enterFrame={0}
            lit
            radius={5}
          />
        );
      })}

      {/* Layout label */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 100,
          display: "flex",
          justifyContent: "center",
          opacity: labelOpacity,
        }}
      >
        <TrackedText
          text={label}
          enterFrame={0}
          fontSize={24}
          color={theme.inkMuted}
          letterSpacing="0.3em"
        />
      </div>

      {/* Whisper text at end */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 60,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <WhisperText
          text="your research, your view."
          enterFrame={whisperEnter}
          fontSize={26}
          color={theme.inkMuted}
        />
      </div>
    </VoidBackground>
  );
};

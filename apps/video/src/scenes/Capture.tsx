import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { LuminousNode } from "../components/LuminousNode";
import { LightTrailEdge } from "../components/LightTrailEdge";
import { UrlBar } from "../components/UrlBar";
import { TrackedText } from "../components/TrackedText";
import { theme } from "../theme";
import type { Position } from "../lib/layout";

const URLS = [
  "google.com/search?q=competitive+analysis",
  "techcrunch.com/2026/ai-market-overview",
  "arxiv.org/abs/2026.01234",
  "github.com/openai/research",
];

/**
 * The demo browsing tree.
 * Each node enters when its corresponding URL "loads".
 */
interface DemoNode {
  id: string;
  label: string;
  x: number;
  y: number;
  parentId: string | null;
  enterFrame: number;
}

const CX = 960;
const CY = 540;

const demoNodes: DemoNode[] = [
  // Root
  { id: "root", label: "Search", x: CX, y: CY - 150, parentId: null, enterFrame: 10 },
  // First URL branch
  { id: "n1", label: "competitive analysis", x: CX - 200, y: CY - 70, parentId: "root", enterFrame: 25 },
  { id: "n2", label: "market overview", x: CX - 320, y: CY + 10, parentId: "n1", enterFrame: 40 },
  { id: "n3", label: "competitor matrix", x: CX - 160, y: CY + 20, parentId: "n1", enterFrame: 55 },
  // Second URL branch
  { id: "n4", label: "AI market overview", x: CX + 80, y: CY - 60, parentId: "root", enterFrame: 90 },
  { id: "n5", label: "funding rounds", x: CX + 200, y: CY + 20, parentId: "n4", enterFrame: 110 },
  { id: "n6", label: "key players", x: CX + 40, y: CY + 30, parentId: "n4", enterFrame: 125 },
  // Third URL branch
  { id: "n7", label: "arxiv paper", x: CX - 80, y: CY + 110, parentId: "n3", enterFrame: 170 },
  { id: "n8", label: "methodology", x: CX - 220, y: CY + 120, parentId: "n2", enterFrame: 185 },
  { id: "n9", label: "results", x: CX - 30, y: CY + 190, parentId: "n7", enterFrame: 200 },
  // Fourth URL branch
  { id: "n10", label: "openai/research", x: CX + 250, y: CY + 110, parentId: "n5", enterFrame: 255 },
  { id: "n11", label: "readme", x: CX + 340, y: CY + 30, parentId: "n10", enterFrame: 270 },
  { id: "n12", label: "benchmarks", x: CX + 160, y: CY + 190, parentId: "n10", enterFrame: 285 },
  { id: "n13", label: "citations", x: CX + 300, y: CY + 190, parentId: "n10", enterFrame: 300 },
  { id: "n14", label: "related work", x: CX - 140, y: CY + 200, parentId: "n8", enterFrame: 310 },
];

/**
 * Scene 4: Capture (frames 0-360 in local time, 540-900 globally)
 * URL bar cycles through URLs. Below, a tree grows node by node.
 */
export const Capture: React.FC = () => {
  const frame = useCurrentFrame();

  const textEnter = 300;

  return (
    <VoidBackground>
      <UrlBar
        urls={URLS}
        framesPerUrl={85}
        enterFrame={5}
        y={70}
      />

      {/* Edges */}
      {demoNodes
        .filter((n) => n.parentId !== null)
        .map((node) => {
          const parent = demoNodes.find((p) => p.id === node.parentId)!;
          return (
            <LightTrailEdge
              key={`edge-${node.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={node.x}
              y2={node.y}
              enterFrame={node.enterFrame - 3}
              drawDuration={15}
              lit
            />
          );
        })}

      {/* Nodes */}
      {demoNodes.map((node) => (
        <LuminousNode
          key={node.id}
          x={node.x}
          y={node.y}
          label={node.label}
          enterFrame={node.enterFrame}
          lit
          radius={5}
        />
      ))}

      {/* "EVERY STEP, CAPTURED" */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 80,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <TrackedText
          text="EVERY STEP, CAPTURED"
          enterFrame={textEnter}
          fontSize={30}
        />
      </div>
    </VoidBackground>
  );
};

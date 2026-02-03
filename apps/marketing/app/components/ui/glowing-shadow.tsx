"use client"

import type { ReactNode } from "react"

interface GlowingShadowProps {
  children: ReactNode
  className?: string
}

export function GlowingShadow({ children, className = "" }: GlowingShadowProps) {
  return (
    <div className={`glow-container ${className}`}>
      <span className="glow"></span>
      <div className="glow-content">{children}</div>
      <style jsx>{`
        .glow-container {
          --card-color: rgb(var(--surface));
          --card-radius: 1.5rem;
          --border-width: 2px;
          --bg-size: 1;
          --hue: 170;
          --hue-speed: 1;
          --rotate: 0;
          --animation-speed: 4s;
          --interaction-speed: 0.55s;
          --glow-scale: 1.5;
          --scale-factor: 1;
          --glow-blur: 6;
          --glow-opacity: 1;
          --glow-radius: 100;
          --glow-rotate-unit: 1deg;

          position: relative;
          z-index: 2;
          border-radius: var(--card-radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .glow-container:before,
        .glow-container:after {
          content: "";
          display: block;
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: var(--card-radius);
        }

        .glow-content {
          position: relative;
          z-index: 3;
          background: var(--card-color);
          border-radius: calc(var(--card-radius) * 0.9);
          overflow: hidden;
          width: 100%;
          height: 100%;
        }

        .glow-content:before {
          content: "";
          display: block;
          position: absolute;
          inset: 0;
          border-radius: calc(var(--card-radius) * 0.9);
          box-shadow: 0 0 20px rgba(0,0,0,0.3);
          mix-blend-mode: color-burn;
          z-index: -1;
          background: radial-gradient(
            30% 30% at calc(var(--bg-x, 0) * 1%) calc(var(--bg-y, 0) * 1%),
            hsl(calc(var(--hue, 170) * var(--hue-speed, 1) * 1deg) 80% 70%) calc(0% * var(--bg-size, 1)),
            hsl(calc(var(--hue, 170) * var(--hue-speed, 1) * 1deg) 80% 60%) calc(20% * var(--bg-size, 1)),
            hsl(calc(var(--hue, 170) * var(--hue-speed, 1) * 1deg) 80% 50%) calc(40% * var(--bg-size, 1)),
            transparent 100%
          );
          animation: hue-animation 4s linear infinite,
                     rotate-bg 4s linear infinite;
          transition: opacity 0.55s ease;
        }

        .glow {
          display: block;
          position: absolute;
          width: 20%;
          height: 20%;
          animation: rotate 4s linear infinite;
          transform: rotateZ(calc(var(--rotate, 0) * 1deg));
          transform-origin: center;
          border-radius: 100vw;
          z-index: 1;
        }

        .glow:after {
          content: "";
          display: block;
          z-index: -2;
          filter: blur(calc(var(--glow-blur, 6) * 10px));
          width: 130%;
          height: 130%;
          left: -15%;
          top: -15%;
          background: hsl(calc(var(--hue, 170) * 1deg) 80% 60%);
          position: relative;
          border-radius: 100vw;
          animation: hue-animation 4s linear infinite;
          transform: scaleY(calc(var(--glow-scale, 1.5) * var(--scale-factor, 1) / 1.1))
                     scaleX(calc(var(--glow-scale, 1.5) * var(--scale-factor, 1) * 1.2))
                     translateY(calc(var(--glow-translate-y, 0) * 1%));
          opacity: var(--glow-opacity, 1);
        }

        .glow-container:hover .glow-content:before {
          animation-play-state: paused;
        }

        .glow-container:hover .glow {
          --glow-blur: 1.5;
          --glow-opacity: 0.6;
          --glow-scale: 2.5;
          --glow-radius: 0;
          --rotate: 900;
          --scale-factor: 1.25;
          animation-play-state: paused;
        }

        .glow-container:hover .glow:after {
          animation-play-state: paused;
          transition: filter 0.05s ease, opacity 0.05s ease, transform 0.05s ease;
        }

        @keyframes rotate-bg {
          0% { background-position: 0% 0%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 0%; }
        }

        @keyframes rotate {
          from { transform: rotateZ(-70deg) translateY(-65%); }
          to { transform: rotateZ(290deg) translateY(-65%); }
        }

        @keyframes hue-animation {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

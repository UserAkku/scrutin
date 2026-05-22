"use client";

import { useEffect, useRef } from "react";
import { getGrade } from "@/lib/utils";

/** Returns a CSS color value based on score thresholds */
function scoreColor(score: number): string {
  if (score >= 80) return "var(--score-great)";   // green
  if (score >= 60) return "var(--accent-cyan)";    // cyan
  if (score >= 40) return "var(--score-fair)";     // amber
  return "var(--score-poor)";                       // red
}

/** Returns a Tailwind text-color class for the center label */
function scoreTailwindClass(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-cyan-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

interface ScoreRingProps {
  /** Score from 0–100 */
  score: number;
  /** Outer diameter in pixels (default 80) */
  size?: number;
  /** Ring stroke width in pixels (default 7) */
  strokeWidth?: number;
  /** Whether to show the grade letter (default true) */
  showGrade?: boolean;
  /** Additional class on the root div */
  className?: string;
}

/**
 * ScoreRing
 * SVG circle-progress ring with an animated stroke draw-on effect.
 * Displays the numeric score and a letter grade in the centre.
 */
export function ScoreRing({
  score,
  size = 80,
  strokeWidth = 7,
  showGrade = true,
  className = "",
}: ScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);

  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const grade = getGrade(clampedScore);
  const color = scoreColor(clampedScore);
  const textClass = scoreTailwindClass(clampedScore);

  // Animate stroke from 0 → target offset on mount / score change
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const targetOffset = circumference - (clampedScore / 100) * circumference;

    // Start at full offset (empty ring) then transition to filled
    el.style.transition = "none";
    el.style.strokeDashoffset = String(circumference);

    // Double-rAF trick to ensure the "none" transition is committed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.strokeDashoffset = String(targetOffset);
      });
    });
  }, [clampedScore, circumference]);

  const cx = size / 2;
  const cy = size / 2;

  /* Font sizes scale relative to ring size */
  const scoreFontSize = Math.round(size * 0.24);
  const gradeFontSize = Math.round(size * 0.14);

  return (
    <div
      className={`score-ring-container relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Score: ${clampedScore} out of 100, Grade: ${grade}`}
      role="img"
    >
      <svg width={size} height={size} aria-hidden="true">
        {/* Track ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress ring */}
        <circle
          ref={circleRef}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference} /* starts empty, JS animates */
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>

      {/* Centre labels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 select-none">
        <span
          className={`font-bold leading-none ${textClass}`}
          style={{ fontSize: scoreFontSize }}
        >
          {clampedScore}
        </span>
        {showGrade && (
          <span
            className="font-mono text-[var(--text-muted)] leading-none"
            style={{ fontSize: gradeFontSize }}
          >
            {grade}
          </span>
        )}
      </div>
    </div>
  );
}

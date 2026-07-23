"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  score: number; // 0..100
  size?: number;
  label?: string;
  /** delay before the count-up starts, in seconds */
  delay?: number;
}

function bandColor(score: number): string {
  if (score >= 80) return "var(--emerald)";
  if (score >= 60) return "var(--amber)";
  if (score >= 40) return "var(--amber-deep)";
  return "var(--rose)";
}

/**
 * The signature Grasp Score dial — an arc that sweeps while the number counts
 * up from zero.
 */
export default function ScoreGauge({ score, size = 240, label, delay = 0.2 }: Props) {
  const [display, setDisplay] = useState(0);
  const progress = useMotionValue(0);

  const stroke = Math.max(8, size * 0.055);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Leave a gap at the bottom: draw 78% of the circle.
  const arcFraction = 0.78;
  const arcLength = circumference * arcFraction;

  const dashOffset = useTransform(progress, (p) => arcLength - arcLength * (p / 100));

  useEffect(() => {
    const controls = animate(progress, score, {
      duration: 1.6,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, delay, progress]);

  const color = bandColor(score);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Score"}: ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-[140deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ink-700)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          style={{ strokeDashoffset: dashOffset, filter: `drop-shadow(0 0 12px ${color}55)` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-semibold tabular-nums leading-none"
          style={{ fontSize: size * 0.3, color }}
        >
          {display}
        </span>
        {label && (
          <span className="mt-2 text-[11px] uppercase tracking-[0.18em] text-chalk-faint">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

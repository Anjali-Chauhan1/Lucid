"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/** The hero line types itself out once on load. */
export default function HeroTagline({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Respect users who don't want motion — show the line immediately.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      setCount(text.length);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [text]);

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-6 font-display text-xl text-amber md:text-2xl"
      aria-label={text}
    >
      <span aria-hidden>{text.slice(0, count)}</span>
      {!reduced && count < text.length && (
        <span aria-hidden className="cursor-blink text-amber-bright">
          ▌
        </span>
      )}
    </motion.p>
  );
}

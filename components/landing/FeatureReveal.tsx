"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   03 — Feature Reveal
   A dark-green card expands from 40 % centred to full-viewport as
   the user scrolls (0 → 30 % progress). Then words in the body
   text light up one by one left-to-right (30 → 100 % progress),
   going from muted green → cream, with "90%" flipping to
   bright yellow as its accent turn arrives.
   ═══════════════════════════════════════════════════════════════ */

/* ── Palette ──────────────────────────────────────────────────── */
const LIGHT_YELLOW  = "#fdf0ac"; // Lighter yellow background
const CREAM  = "#1a1a1a"; // Active text (graphite)
const MUTED  = "rgba(26, 26, 26, 0.25)"; // Inactive text
const ACCENT_COLOR = "#000000"; // Accent word (dark)

/* The accent word drops during the hold at the end of the scroll (see
   WORD_WINDOW_END / the 0.85 → 1.0 hold below), and its colour blends
   from cream into `--paper` — the footer's own background, i.e. page 4,
   the 100vh section right after this one. It stays readable against the
   yellow card the whole way (paper is much lighter than the card), so it
   reads as previewing the next section's colour, not vanishing. */
const ACCENT_FALL_START = 0.85;
const ACCENT_FALL_END   = 1.0;
const ACCENT_FALL_DISTANCE = 46; // px
const NEXT_PAGE_BG = "#f2f1ec"; // var(--paper) — SiteFooter's background

/* ── Body words ───────────────────────────────────────────────── */
const WORDS: { text: string; accent: "yellow" | null }[] = [
  { text: "Learners",  accent: null   },
  { text: "who",       accent: null   },
  { text: "teach",     accent: null   },
  { text: "a",         accent: null   },
  { text: "concept",   accent: null   },
  { text: "out",       accent: null   },
  { text: "loud",      accent: null   },
  { text: "retain",    accent: null   },
  { text: "90%",       accent: "yellow" },
  { text: "more",      accent: null   },
  { text: "than",      accent: null   },
  { text: "those",     accent: null   },
  { text: "who",       accent: null   },
  { text: "simply",    accent: null   },
  { text: "re-read",   accent: null   },
  { text: "it",        accent: null   },
  { text: "silently.", accent: null   },
  { text: "That's",    accent: null   },
  { text: "the",       accent: null   },
  { text: "protégé",   accent: null   },
  { text: "effect",    accent: null   },
  { text: "Lucid",     accent: null   },
  { text: "is",        accent: null   },
  { text: "built",     accent: null   },
  { text: "on.",       accent: null   },
];

/* ── Word animation range ─────────────────────────────────────── */
const WORD_WINDOW_START = 0.30; // card fully expanded at 0.30
const WORD_WINDOW_END   = 0.85; // last word fully lit well before section unpins
const WORD_WINDOW       = WORD_WINDOW_END - WORD_WINDOW_START;

/* ── Per-word component ───────────────────────────────────────── *
   Each Word calls its own useTransform — valid because Word is a
   real React component, not a callback, so hooks are at top level. */
function Word({
  text,
  accent,
  scrollYProgress,
  start,
  end,
}: {
  text: string;
  accent: "yellow" | null;
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const targetColor = accent === "yellow" ? ACCENT_COLOR : CREAM;
  const color = useTransform(
    scrollYProgress,
    [start, Math.min(end, 0.98)],
    [MUTED, targetColor],
    { clamp: true },
  );
  return (
    <motion.span style={{ color }} className="inline">
      {text}{" "}
    </motion.span>
  );
}

/* ── Accent word ──────────────────────────────────────────────── *
   Same muted → cream reveal as any other word, but with two extra
   keyframes tacked on past its own window: held at cream, then blended
   into GREEN (the card's own background) during the end-of-scroll hold,
   while it drops a little — so it reads as sinking into the card rather
   than just stopping. A separate component (not a branch inside `Word`)
   so neither one ever calls hooks conditionally. */
function AccentWord({
  text,
  scrollYProgress,
  start,
  end,
}: {
  text: string;
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const clampedEnd = Math.min(end, 0.98);
  const color = useTransform(
    scrollYProgress,
    [start, clampedEnd, ACCENT_FALL_START, ACCENT_FALL_END],
    [MUTED, ACCENT_COLOR, ACCENT_COLOR, NEXT_PAGE_BG],
    { clamp: true },
  );
  const y = useTransform(
    scrollYProgress,
    [ACCENT_FALL_START, ACCENT_FALL_END],
    [0, ACCENT_FALL_DISTANCE],
    { clamp: true },
  );
  return (
    <motion.span style={{ color, y }} className="inline-block">
      {text}{" "}
    </motion.span>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function FeatureReveal() {
  const reduced    = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  /* Single scroll source — offset ["start start","end end"] means
     progress 0 when section-top = viewport-top, and 1 when
     section-bottom = viewport-bottom. For 380 vh that's 280 vh of
     actual scroll travel. The last 15 % (0.85 → 1.0, ≈ 42 vh) is a
     deliberate hold: nothing changes, so the fully-highlighted card
     sits still for a beat before it unpins, instead of unpinning the
     instant the last word finishes lighting up. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* Card geometry ── 0 → 0.30 ───────────────────────────────────
     `{ clamp: true }` made explicit on every one of these (framer's
     documented default, but forcing it here ruled out a real bug during
     testing: several of these read back as small fractional values deep
     into the scroll — e.g. 0.12 opacity at ~89% progress, well past every
     window below — rather than holding at their settled endpoint).

     No opacity ramp on the card itself: `scrollYProgress` only starts
     moving once this section's top edge reaches the viewport's top, but
     the sticky box is already visible scrolling up from the bottom of
     the viewport well before that — with a fade-in tied to progress, that
     whole approach read as a dead, empty gap right where the Problem
     section's blue ends. Rendering solid from the start means the card
     is already there, centred, the instant it comes into view. */
  const cardW      = useTransform(scrollYProgress, [0, 0.30], ["40%",  "100%"], { clamp: true });
  const cardH      = useTransform(scrollYProgress, [0, 0.30], ["45vh", "100vh"], { clamp: true });
  const cardRadius = useTransform(scrollYProgress, [0, 0.30], [32, 0], { clamp: true });

  /* Heading and body sit at full opacity as soon as the card is visible —
     only the per-word colour (muted → cream) carries the "highlight"
     reveal. Fading the heading/body containers on top of that made the
     whole card read as washed-out/disappearing instead of highlighting. */
  const headY = useTransform(scrollYProgress, [0.22, 0.38], [24, 0], { clamp: true });

  /* Per-word timing ─────────────────────────────────────────── */
  const n       = WORDS.length;          // 18 words
  const perWord = WORD_WINDOW / n;       // ≈ 0.039 per word
  const overlap = 1.6;                   // highlight span = 1.6× slot

  return (
    <section
      ref={sectionRef}
      id="highlights"
      className="section-anchor relative"
      style={{ minHeight: "380vh", background: "var(--paper)" }}
    >
      {/* ── Sticky frame ── */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">

        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden paper-field"
          style={
            reduced
              ? { width: "100%", height: "100vh", borderRadius: 0, backgroundColor: LIGHT_YELLOW }
              : {
                  width:        cardW,
                  height:       cardH,
                  borderRadius: cardRadius,
                  backgroundColor: LIGHT_YELLOW,
                }
          }
        >
          <div className="flex h-full w-full flex-col items-center justify-center px-8 py-12 md:px-20">

            {/* ── Heading ── */}
            <motion.h2
              className="w-full text-center font-display font-bold tracking-tight"
              style={
                reduced
                  ? { color: CREAM, fontSize: "clamp(2.2rem,5vw,4.5rem)" }
                  : { color: CREAM, fontSize: "clamp(2.2rem,5vw,4.5rem)", y: headY }
              }
            >
              Did you know?
            </motion.h2>

            {/* ── Body text ── */}
            <motion.p
              className="mt-6 max-w-3xl text-left font-display font-bold leading-[1.6] md:mt-10"
              style={
                reduced
                  ? { color: CREAM, fontSize: "clamp(1.3rem,2.6vw,2.1rem)" }
                  : { fontSize: "clamp(1.3rem,2.6vw,2.1rem)" }
              }
            >
              {reduced
                /* Reduced motion: all words visible immediately */
                ? WORDS.map((w, i) => (
                    <span
                      key={i}
                      style={{ color: w.accent === "yellow" ? ACCENT_COLOR : CREAM }}
                    >
                      {w.text}{" "}
                    </span>
                  ))
                /* Full motion: per-word scroll-driven colour */
                : WORDS.map((w, i) => {
                    const s = WORD_WINDOW_START + i * perWord;
                    const e = s + perWord * overlap;
                    return w.accent === "yellow" ? (
                      <AccentWord
                        key={i}
                        text={w.text}
                        scrollYProgress={scrollYProgress}
                        start={s}
                        end={Math.min(e, 0.99)}
                      />
                    ) : (
                      <Word
                        key={i}
                        text={w.text}
                        accent={w.accent}
                        scrollYProgress={scrollYProgress}
                        start={s}
                        end={Math.min(e, 0.99)}
                      />
                    );
                  })
              }
            </motion.p>

          </div>
        </motion.div>

      </div>
    </section>
  );
}

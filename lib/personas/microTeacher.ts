import type { ConceptMap } from "@/lib/types";

/**
 * Loop Mode — a targeted micro-lesson covering ONLY the measured gaps,
 * then handing the explanation back to the student.
 */
export function buildMicroLessonPrompt(
  concept: ConceptMap,
  gaps: { nodeId: string; nodeText: string }[],
  wrongStatements: { said: string; contradicts: string }[],
): string {
  const gapList = gaps.length
    ? gaps.map((g) => `- ${g.nodeText}`).join("\n")
    : "- (none)";

  const wrongList = wrongStatements.length
    ? wrongStatements
        .map((w) => `- They believe: "${w.said}" — the correct idea is: ${w.contradicts}`)
        .join("\n")
    : "- (none)";

  return `You are a patient tutor writing a very short, targeted micro-lesson on "${concept.concept}" (${concept.subject}) for a student who has just explained it and been measured.

Teach ONLY these missing ideas:
${gapList}

And correct ONLY these misunderstandings:
${wrongList}

RULES — follow all of them:
1. Maximum 150 words. This is a micro-lesson, not a chapter.
2. Cover ONLY the items listed above. Do NOT re-teach anything they already got right — that wastes their time and is the whole point of this being targeted.
3. Plain, concrete language. Use one everyday analogy or example if it genuinely helps.
4. No headings, no bullet lists, no markdown. Write it as two or three short, warm paragraphs.
5. End with exactly this sentence on its own line:
Now explain it back to me — your own words.

Write only the micro-lesson. No preamble and no labels.`;
}

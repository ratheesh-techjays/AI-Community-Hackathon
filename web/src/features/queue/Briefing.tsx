import { useState, type JSX } from "react";

import type { StageId } from "@/components/StageTimeline";
import { text } from "@/design/typography.css";
import type { BriefingData } from "@/features/scenario/types";

import * as styles from "./Briefing.css";

/**
 * The stage briefing: Gemini's narration of the engine's numbers.
 *
 * `generatedBy` is shown, never hidden (04-ai-layer.md §4): a reader can see
 * whether a paragraph was written by Gemini, repaired after the validator
 * rejected a number, or is the deterministic template. Caveats are injected
 * from the model disclosure, not written by the model.
 */

const SOURCE_LABEL: Record<BriefingData["generatedBy"], string> = {
  GEMINI: "Written by Gemini · every number matched",
  GEMINI_REPAIRED: "Gemini, repaired · a number was rejected and rewritten",
  TEMPLATE_FALLBACK: "Template · AI unavailable or failed the number check",
};

export function Briefing({
  stage,
  briefings,
}: {
  stage: StageId;
  briefings: BriefingData[];
}): JSX.Element | null {
  const [language, setLanguage] = useState<"en" | "or">("en");
  const forStage = briefings.filter((b) => b.stage === stage);
  const briefing = forStage.find((b) => b.language === language) ?? forStage[0];
  if (!briefing) return null;
  const hasOdia = forStage.some((b) => b.language === "or");

  return (
    <section className={styles.panel} aria-label="Stage briefing">
      <div className={styles.head}>
        <h3 className={`${text.label} ${styles.kicker}`}>STAGE BRIEFING</h3>
        {hasOdia ? (
          <div className={styles.toggle} role="group" aria-label="Briefing language">
            {(["en", "or"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                className={language === lang ? styles.langOn : styles.langOff}
                aria-pressed={language === lang}
                onClick={() => {
                  setLanguage(lang);
                }}
              >
                {lang === "en" ? "English" : "ଓଡ଼ିଆ"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className={language === "or" ? text.bodyStrongOd : text.bodyStrong} lang={briefing.language}>
        {briefing.headline}
      </p>
      <p className={language === "or" ? text.bodyOd : text.body} lang={briefing.language}>
        {briefing.situation}
      </p>
      {briefing.notice ? <p className={`${text.caption} ${styles.notice}`}>{briefing.notice}</p> : null}
      <p className={`${text.caption} ${styles.source}`}>
        {SOURCE_LABEL[briefing.generatedBy]}
        {briefing.modelId ? ` · ${briefing.modelId}` : ""} · {briefing.numbersChecked} numbers
        matched to engine output; wording checked for banned claims only
      </p>
      <ul className={styles.caveats}>
        {briefing.caveats.map((c) => (
          <li key={c} className={text.caption}>
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}

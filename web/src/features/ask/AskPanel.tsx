import { useMutation } from "@tanstack/react-query";
import { useId, useState, type JSX, type SyntheticEvent } from "react";

import { queryApi, type QueryResponse } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import { text } from "@/design/typography.css";

import * as styles from "./AskPanel.css";

/**
 * "Ask this run": Gemini function calling over the stored engine output.
 *
 * The answer is shown with the tools it called and whether it passed the
 * number check, so an official can see what was looked up rather than trust
 * a confident paragraph. A failed check shows the raw engine output instead.
 */

/**
 * Example questions drawn from this run, so they never name a block the run
 * does not contain: the hardest-hit block when there is a register, generic
 * questions when there is not.
 */
function examplesFor(topBlock: string | null): string[] {
  const reliability = "How reliable is the flood extent?";
  if (!topBlock) return [reliability, "How many people are in the modelled flood?", "What does this model not capture?"];
  const block = topBlock.charAt(0) + topBlock.slice(1).toLowerCase();
  return [
    `Which shelters in ${block} block are inside the surge zone?`,
    reliability,
    "Which blocks have the most people without a shelter place?",
  ];
}

export function AskPanel({ runId, topBlock = null }: { runId: string; topBlock?: string | null }): JSX.Element {
  const EXAMPLES = examplesFor(topBlock);
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const ask = useMutation<QueryResponse, Error, string>({
    mutationFn: (q) => queryApi.ask({ question: q, run_id: runId, language: "en" }),
  });

  const submit = (e: SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const q = question.trim();
    if (q.length >= 3) ask.mutate(q);
  };

  const err = ask.error instanceof ApiError ? ask.error : null;

  return (
    <section className={styles.panel} aria-label="Ask this run">
      <form className={styles.form} onSubmit={submit}>
        <label htmlFor={inputId} className={`${text.label} ${styles.kicker}`}>
          ASK THIS RUN
        </label>
        <div className={styles.row}>
          <input
            id={inputId}
            className={styles.input}
            value={question}
            maxLength={500}
            placeholder={EXAMPLES[0]}
            onChange={(e) => {
              setQuestion(e.target.value);
            }}
          />
          <button type="submit" className={styles.submit} disabled={ask.isPending || question.trim().length < 3}>
            {ask.isPending ? "Looking up…" : "Ask"}
          </button>
        </div>
        <div className={styles.examples}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className={styles.example}
              onClick={() => {
                setQuestion(ex);
                ask.mutate(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      <div aria-live="polite">
        {err ? (
          <p className={`${text.body} ${styles.error}`} role="alert">
            {err.status === 429
              ? "Too many questions this minute. Try again shortly."
              : err.title}
          </p>
        ) : null}
        {ask.data ? (
          <div className={styles.answer}>
            <p className={text.body}>{ask.data.answer}</p>
            <p className={`${text.caption} ${styles.meta}`}>
              {ask.data.generated_by === "GEMINI"
                ? `Written by Gemini · ${ask.data.grounding.found.length} numbers matched to engine output (numbers only)`
                : "Gemini unavailable or failed the number check · showing engine output"}
              {" · "}
              {ask.data.tool_calls.length
                ? `looked up: ${ask.data.tool_calls.map((c) => c.name).join(", ")}`
                : "no lookups"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

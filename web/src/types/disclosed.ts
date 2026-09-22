/**
 * THE FRONTEND'S HONESTY GUARANTEE (principle F1).
 *
 * The backend guarantees caveats are SENT -- `SurgeEstimateOut.model_class` is
 * a Literal, `limitations` is non-empty, and contract tests C1-C6 fail the
 * build otherwise. Nothing, however, guaranteed they would be SHOWN.
 *
 * `Disclosed<T>` closes that gap. A modelled value is wrapped at the query
 * boundary and can only be read by:
 *   - <DisclosedValue>, which renders the disclosure badge, or
 *   - unsafeUnwrap(d, reason), which is grep-able, reviewable, and warns in dev.
 *
 * Dropping our caveats stops being something that can happen by accident.
 */

declare const disclosedBrand: unique symbol;

export type ModelClass = "heuristic_index" | "parametric_physical" | "optimisation";

export interface ModelDisclosure {
  model_class: ModelClass;
  limitations: string[];
  validated_against?: string | null;
  skill_metric?: Record<string, number> | null;
}

export interface Disclosed<T> {
  readonly [disclosedBrand]: "disclosed";
  readonly value: T;
  readonly disclosure: ModelDisclosure;
}

export function disclose<T>(value: T, disclosure: ModelDisclosure): Disclosed<T> {
  return { value, disclosure } as unknown as Disclosed<T>;
}

/**
 * Explicit escape hatch. Use only where a raw value is genuinely required
 * (chart axes, map layer inputs, CSV export) and the disclosure is shown
 * elsewhere on the same screen. The `reason` is mandatory so code review can
 * see the justification without archaeology.
 */
export function unsafeUnwrap<T>(datum: Disclosed<T>, reason: string): T {
  if (import.meta.env.DEV) {
    console.warn(`[disclosure] unwrapped without a badge: ${reason}`);
  }
  return datum.value;
}

/** Which badge to render. `validated` outranks `heuristic`. */
export function disclosureVariant(
  disclosure: ModelDisclosure,
): "heuristic" | "validated" | "modelled" {
  if (disclosure.validated_against) return "validated";
  if (disclosure.model_class === "heuristic_index") return "heuristic";
  return "modelled";
}

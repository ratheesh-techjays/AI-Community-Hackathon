import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type JSX } from "react";
import { Link } from "react-router-dom";

import { scenariosApi, stormsApi } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icon } from "@/components/Icon";
import { text } from "@/design/typography.css";

import { STORM_OPTIONS } from "./registry";
import type { StormOption } from "./types";
import * as styles from "./StormSelectorScreen.css";

/**
 * THE ENTRY SCREEN: pick a storm.
 *
 * The product is not Fani-only. Fani and Yaas are precomputed by the real
 * pipeline, so they are featured; a storm whose coast has an AOI preset can be
 * modelled on demand through the backend (POST /scenarios). A storm with no
 * preset says so instead of pretending to run.
 *
 * The truth flags are shown up front because they decide what a run can
 * honestly claim. Michaung, for instance, can be modelled but never
 * validated — there is no post-landfall Sentinel-1 imagery — and the backend
 * refuses to fabricate a score (HTTP 424).
 */

export function StormSelectorScreen(): JSX.Element {
  // Overlay the live catalogue when the API is up; the static list is the
  // fallback so the screen never goes blank.
  const catalogue = useQuery({
    queryKey: queryKeys.storms(),
    queryFn: stormsApi.list,
    meta: { silent: true },
  });

  const liveByName = new Map(
    (catalogue.data?.storms ?? []).map((s) => [`${s.name}-${s.season}`, s] as const),
  );

  const featured = STORM_OPTIONS.filter((s) => s.runId);
  const others = STORM_OPTIONS.filter((s) => !s.runId);

  return (
    <div className={styles.screen}>
      <section className={styles.group}>
        <h2 className={`${text.label} ${styles.groupTitle}`}>PRECOMPUTED · READY TO OPEN</h2>
        <div className={styles.grid}>
          {featured.map((s) => (
            <StormCard key={s.name} storm={s} live={liveByName.get(`${s.name}-${s.season}`)} />
          ))}
        </div>
      </section>

      <section className={styles.group}>
        <h2 className={`${text.label} ${styles.groupTitle}`}>MODEL ON DEMAND</h2>
        <p className={`${text.caption} ${styles.groupNote}`}>
          Runs a full scenario on the backend: track, wind field, inundation, exposure, orders.
          {catalogue.isError ? " Backend unreachable — start it with make dev." : ""}
        </p>
        <div className={styles.grid}>
          {others.map((s) => (
            <StormCard key={s.name} storm={s} live={liveByName.get(`${s.name}-${s.season}`)} />
          ))}
        </div>
      </section>

      <p className={`${text.caption} ${styles.foot}`}>
        Runs replay IBTrACS best-track. Live GDACS feeds and Gemini-read IMD bulletin PDFs are the
        next ingestion step; the API rejects those track kinds today (HTTP 400) rather than faking them.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------

function StormCard({
  storm,
  live,
}: {
  storm: StormOption;
  live?: { has_sar_truth: boolean; has_ems_activation: boolean; note: string } | undefined;
}): JSX.Element {
  const [accepted, setAccepted] = useState<{ runId: string; cacheHit: boolean } | null>(null);

  const run = useMutation({
    mutationFn: () =>
      scenariosApi.create(
        {
          track: { kind: "ibtracs", storm_name: storm.name, season: storm.season },
          aoi_preset: storm.aoiPreset ?? "puri_khordha",
          hazard: { dem_offset_m: 0 },
          generate_advisories: true,
          run_validation: storm.hasSarTruth,
          languages: ["en", "or"],
        },
        crypto.randomUUID(),
      ),
    onSuccess: (res) => {
      setAccepted({ runId: res.run_id, cacheHit: res.cache_hit });
    },
  });

  const sar = live?.has_sar_truth ?? storm.hasSarTruth;
  const ems = live?.has_ems_activation ?? storm.hasEmsActivation;
  const err = run.error instanceof ApiError ? run.error : null;

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>
            Cyclone {storm.name.charAt(0) + storm.name.slice(1).toLowerCase()}
          </h3>
          <p className={`${text.caption} ${styles.cardMeta}`}>
            {storm.landfallLabel} · {storm.district}, {storm.state}
          </p>
        </div>
        {storm.runId ? (
          <span className={`${text.metric} ${styles.pillValidated}`}>
            <Icon name="check" size={12} /> PRECOMPUTED
          </span>
        ) : null}
      </header>

      <ul className={styles.flags}>
        <li className={sar ? styles.flagOn : styles.flagOff}>
          <Icon name={sar ? "satellite" : "missed"} size={12} />
          {sar ? "Sentinel-1 truth available" : "No satellite truth"}
        </li>
        <li className={ems ? styles.flagOn : styles.flagOff}>
          <Icon name={ems ? "check" : "missed"} size={12} />
          {ems ? "Copernicus EMS cross-check" : "No EMS activation"}
        </li>
      </ul>

      <p className={`${text.caption} ${styles.note}`}>{live?.note ?? storm.note}</p>

      <div className={styles.cardActions}>
        {storm.runId ? (
          <Link to={`/scenarios/${storm.runId}/orders`} className={styles.primary}>
            Open run
          </Link>
        ) : accepted ? (
          <Link to={`/scenarios/${accepted.runId}/orders`} className={styles.primary}>
            {accepted.cacheHit ? "Open run" : "Run queued · open"}
          </Link>
        ) : !storm.aoiPreset ? (
          <span className={`${text.caption} ${styles.accepted}`}>
            No modelling area configured for this coast yet
          </span>
        ) : (
          <button
            type="button"
            className={styles.secondary}
            disabled={run.isPending}
            onClick={() => {
              run.mutate();
            }}
          >
            {run.isPending ? "Starting…" : "Run scenario"}
          </button>
        )}
        {err ? (
          <span className={`${text.caption} ${styles.error}`}>
            {err.isTruthUnavailable
              ? "Cannot validate: no satellite truth for this storm."
              : err.status === 429
                ? "Another scenario is computing. Try again in a minute."
                : err.status === 401
                  ? "Modelling a new storm is operator-only on this deployment; open a precomputed run."
                  : err.title}
          </span>
        ) : null}
      </div>
    </article>
  );
}

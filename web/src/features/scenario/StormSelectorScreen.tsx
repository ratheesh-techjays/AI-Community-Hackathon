import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useId, useMemo, useState, type JSX } from "react";
import { Link, useNavigate } from "react-router-dom";

import { scenariosApi, stormsApi, type StormSummary } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { text } from "@/design/typography.css";

import * as styles from "./StormSelectorScreen.css";

/**
 * THE ENTRY SCREEN: what PRAHARI is, then pick a storm.
 *
 * The catalogue is every named storm in IBTrACS (GET /storms), not a hand
 * list. Each row says where the storm made landfall, whether PRAHARI can
 * model it, and whether its flood extent could ever be checked against
 * Sentinel-1 — with the reason when not. Storms with a stored run open
 * instantly; they lead the page.
 */

const PAGE = 24;
const START_STORM = "FANI";
const KT_TO_KMH = 1.852;

const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

const landfallDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );

export function StormSelectorScreen(): JSX.Element {
  const catalogue = useQuery({
    queryKey: queryKeys.storms(),
    queryFn: stormsApi.list,
    meta: { silent: true },
  });
  const storms = catalogue.data?.storms ?? [];
  // Fani leads: it is the storm the product was built and checked on.
  const featured = storms
    .filter((s) => s.precomputed_run)
    .sort((a, b) => Number(b.name === START_STORM) - Number(a.name === START_STORM));

  return (
    <div className={styles.screen}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <h2 id="hero-title" className={styles.heroTitle}>
          From a cyclone track to the orders a district must give, and when.
        </h2>
        <p className={`${text.body} ${styles.heroLead}`}>
          Pick a storm. PRAHARI models where its surge could flood, who lives there, which cyclone
          shelters are unsafe, and what each office should do at each IMD warning stage. Every
          number says how far to trust it.
        </p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={`${text.metric} ${styles.stepNo}`}>1</span>
            <span>
              <span className={text.bodyStrong}>Track</span>
              <span className={`${text.caption} ${styles.stepNote}`}>IBTrACS best track</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={`${text.metric} ${styles.stepNo}`}>2</span>
            <span>
              <span className={text.bodyStrong}>Wind, surge and flood</span>
              <span className={`${text.caption} ${styles.stepNote}`}>Earth Engine elevation, population, buildings</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={`${text.metric} ${styles.stepNo}`}>3</span>
            <span>
              <span className={text.bodyStrong}>Orders and shelters</span>
              <span className={`${text.caption} ${styles.stepNote}`}>Who does what, by when</span>
            </span>
          </li>
        </ol>
      </section>

      <section className={styles.group} aria-labelledby="ready-title">
        <h2 id="ready-title" className={`${text.label} ${styles.groupTitle}`}>
          COMPUTED RUNS · OPEN INSTANTLY
        </h2>
        {catalogue.isPending ? (
          // Same height as a loaded card, so nothing below jumps when it lands.
          <div className={styles.grid} aria-busy="true">
            <Skeleton height="11.5rem" />
            <Skeleton height="11.5rem" />
          </div>
        ) : catalogue.isError ? (
          <p className={`${text.body} ${styles.error}`} role="alert">
            The backend is not reachable, so the storm list cannot load. Start it with{" "}
            <code>make dev</code> in <code>backend/</code>, then reload.
          </p>
        ) : (
          <div className={styles.grid}>
            {featured.map((s, i) => (
              <FeaturedCard key={s.sid} storm={s} primary={i === 0 && s.name === START_STORM} />
            ))}
          </div>
        )}
      </section>

      {catalogue.data ? (
        <Catalogue storms={storms} />
      ) : catalogue.isPending ? (
        <section className={styles.group} aria-busy="true" aria-label="Loading the storm catalogue">
          <Skeleton height="1rem" width="16rem" />
          <Skeleton height="4rem" />
          <Skeleton height="24rem" />
        </section>
      ) : null}

      <section className={styles.honesty} aria-labelledby="honesty-title">
        <h2 id="honesty-title" className={`${text.label} ${styles.groupTitle}`}>
          WHAT TO TRUST
        </h2>
        <div className={styles.honestyGrid}>
          <div>
            <p className={`${text.bodyStrong} ${styles.honestyHead}`}>
              <Icon name="check" size={14} /> Measured inputs
            </p>
            <p className={`${text.caption} ${styles.note}`}>
              Storm tracks (IBTrACS), elevation (Copernicus GLO-30), population (WorldPop),
              buildings (Open Buildings), and the 877-shelter OSDMA register for Odisha.
            </p>
          </div>
          <div>
            <p className={`${text.bodyStrong} ${styles.honestyHead}`}>
              <Icon name="heuristic" size={14} /> Heuristic outputs
            </p>
            <p className={`${text.caption} ${styles.note}`}>
              Surge height is an index, not a forecast. The flood extent failed its satellite check
              for Fani (overlap score 0.001), so every screen marks it heuristic.
            </p>
          </div>
          <div>
            <p className={`${text.bodyStrong} ${styles.honestyHead}`}>
              <Icon name="missed" size={14} /> Not built yet
            </p>
            <p className={`${text.caption} ${styles.note}`}>
              Road routing (distances are straight line × 1.3), hospitals and power assets, live
              GDACS and IMD bulletin feeds, and shelter registers outside Odisha.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------------------

function FeaturedCard({ storm, primary }: { storm: StormSummary; primary: boolean }): JSX.Element {
  const run = storm.precomputed_run ?? "";
  return (
    <article className={primary ? styles.cardPrimary : styles.card}>
      <header className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>
            Cyclone {titleCase(storm.name)} <span className={styles.cardYear}>{storm.season}</span>
          </h3>
          <p className={`${text.caption} ${styles.cardMeta}`}>
            {storm.landfall_at ? `Landfall ${landfallDate(storm.landfall_at)}` : "No landfall"}
            {storm.landfall_coast ? ` · ${storm.landfall_coast}` : ""}
          </p>
        </div>
        {primary ? <span className={`${text.metric} ${styles.startHere}`}>START HERE</span> : null}
      </header>
      {storm.note ? <p className={`${text.caption} ${styles.note}`}>{storm.note}</p> : null}
      <div className={styles.cardActions}>
        <Link to={`/scenarios/${run}/overview`} className={primary ? styles.primary : styles.secondary}>
          Open {titleCase(storm.name)}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

function Catalogue({ storms }: { storms: StormSummary[] }): JSX.Element {
  const searchId = useId();
  const coastId = useId();
  const yearId = useId();
  const [query, setQuery] = useState("");
  const [coast, setCoast] = useState("");
  const [decade, setDecade] = useState("");
  const [modellableOnly, setModellableOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toUpperCase());

  const coasts = useMemo(
    () => [...new Set(storms.map((s) => s.landfall_coast).filter((c): c is string => Boolean(c)))].sort(),
    [storms],
  );
  const decades = useMemo(
    () => [...new Set(storms.map((s) => Math.floor(s.season / 10) * 10))].sort((a, b) => b - a),
    [storms],
  );

  const shown = storms.filter(
    (s) =>
      (!q || s.name.includes(q) || String(s.season).startsWith(q)) &&
      (!coast || s.landfall_coast === coast) &&
      (!decade || Math.floor(s.season / 10) * 10 === Number(decade)) &&
      (!modellableOnly || s.modellable),
  );

  return (
    <section className={styles.group} aria-labelledby="catalogue-title">
      <div className={styles.catalogueHead}>
        <h2 id="catalogue-title" className={`${text.label} ${styles.groupTitle}`}>
          ANY NORTH INDIAN OCEAN CYCLONE
        </h2>
        <p className={`${text.caption} ${styles.groupNote}`}>
          Every named storm in the IBTrACS best-track file, with where it made landfall and what a
          run of it could honestly claim.
        </p>
      </div>

      <div className={styles.filters} role="search">
        <label className={styles.field} htmlFor={searchId}>
          <span className={`${text.label} ${styles.fieldLabel}`}>NAME OR YEAR</span>
          <input
            id={searchId}
            className={styles.input}
            type="search"
            placeholder="e.g. Amphan, Hudhud, 2020"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <label className={styles.field} htmlFor={coastId}>
          <span className={`${text.label} ${styles.fieldLabel}`}>LANDFALL</span>
          <select
            id={coastId}
            className={styles.input}
            value={coast}
            onChange={(e) => {
              setCoast(e.target.value);
              setLimit(PAGE);
            }}
          >
            <option value="">Any coast</option>
            {coasts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field} htmlFor={yearId}>
          <span className={`${text.label} ${styles.fieldLabel}`}>DECADE</span>
          <select
            id={yearId}
            className={styles.input}
            value={decade}
            onChange={(e) => {
              setDecade(e.target.value);
              setLimit(PAGE);
            }}
          >
            <option value="">Any year</option>
            {decades.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={modellableOnly}
            onChange={(e) => {
              setModellableOnly(e.target.checked);
              setLimit(PAGE);
            }}
          />
          <span className={text.body}>Only storms PRAHARI can model</span>
        </label>
      </div>

      <p className={`${text.caption} ${styles.count}`} aria-live="polite">
        {shown.length} of {storms.length} storms
      </p>

      {shown.length === 0 ? (
        <p className={`${text.body} ${styles.empty}`}>
          No storm matches. Clear a filter, or untick “Only storms PRAHARI can model” to see storms
          that never made landfall or struck outside the covered coasts.
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.slice(0, limit).map((s) => (
            <StormRow key={s.sid} storm={s} />
          ))}
        </ul>
      )}
      {shown.length > limit ? (
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setLimit((n) => n + PAGE * 2);
          }}
        >
          Show more ({shown.length - limit} left)
        </button>
      ) : null}
    </section>
  );
}

function StormRow({ storm }: { storm: StormSummary }): JSX.Element {
  const peakKmh = storm.peak_wind_kt ? Math.round(storm.peak_wind_kt * KT_TO_KMH) : null;
  return (
    <li className={storm.modellable ? styles.row : styles.rowMuted}>
      <div className={styles.rowName}>
        <span className={text.bodyStrong}>{titleCase(storm.name)}</span>
        <span className={`${text.metric} ${styles.rowYear}`}>{storm.season}</span>
      </div>
      <div className={styles.rowWhere}>
        <span className={text.body}>
          {storm.landfall_coast ?? (storm.landfall_at ? "Outside covered coasts" : "No landfall")}
        </span>
        <span className={`${text.caption} ${styles.cardMeta}`}>
          {storm.landfall_at ? landfallDate(storm.landfall_at) : "Stayed at sea"}
          {peakKmh ? ` · peak ${peakKmh.toLocaleString("en-IN")} km/h` : ""}
        </span>
      </div>
      <ul className={styles.rowFlags}>
        {storm.modellable ? null : (
          <li className={styles.flagOff}>
            <Icon name="missed" size={12} />
            {storm.not_modellable_reason}
          </li>
        )}
        {storm.modellable ? (
          <li className={storm.sar_possible ? styles.flagOn : styles.flagOff}>
            <Icon name={storm.sar_possible ? "satellite" : "missed"} size={12} />
            {storm.sar_possible ? "Satellite check possible" : storm.no_sar_reason}
          </li>
        ) : null}
      </ul>
      <div className={styles.rowAction}>
        {storm.precomputed_run ? (
          <Link to={`/scenarios/${storm.precomputed_run}/overview`} className={styles.primarySmall}>
            Open
          </Link>
        ) : storm.modellable ? (
          <ModelButton storm={storm} />
        ) : null}
      </div>
    </li>
  );
}

/**
 * Starts a real run for a storm: the AOI is drawn around its landfall
 * ("auto"), and validation is asked for only when a Sentinel-1 score could
 * exist. The run page shows progress and opens itself when done.
 */
function ModelButton({ storm }: { storm: StormSummary }): JSX.Element {
  const navigate = useNavigate();
  const run = useMutation({
    mutationFn: () =>
      scenariosApi.create(
        {
          track: { kind: "ibtracs", storm_name: storm.name, season: storm.season },
          aoi_preset: "auto",
          hazard: { dem_offset_m: 0 },
          generate_advisories: true,
          run_validation: storm.sar_possible,
          languages: ["en", "or"],
        },
        crypto.randomUUID(),
      ),
    onSuccess: (res) => {
      navigate(`/scenarios/${res.run_id}/overview`);
    },
  });
  const err = run.error instanceof ApiError ? run.error : null;
  return (
    <span className={styles.modelCell}>
      <button
        type="button"
        className={styles.secondarySmall}
        disabled={run.isPending}
        onClick={() => {
          run.mutate();
        }}
      >
        {run.isPending ? "Starting…" : "Model it"}
      </button>
      {err ? (
        <span className={`${text.caption} ${styles.error}`} role="alert">
          {err.plain}
        </span>
      ) : run.error ? (
        <span className={`${text.caption} ${styles.error}`} role="alert">
          Could not reach the backend.
        </span>
      ) : null}
    </span>
  );
}

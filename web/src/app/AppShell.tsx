import { useEffect, useState, type JSX } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";

import { Icon, type IconName } from "@/components/Icon";
import { statusDot } from "@/design/effects.css";
import { text } from "@/design/typography.css";
import { useOrderLedger } from "@/features/orders/orderLedger";
import { useRunData } from "@/features/scenario/useScenario";

import * as styles from "./AppShell.css";

/**
 * The application frame: a slim left rail and a scrolling main area with a
 * sticky page header.
 *
 * The shell is scenario-aware. Under /scenarios/:runId the rail shows the
 * run's sections and the storm block; at the root it shows only the storm
 * list. The product is not one storm — a run is what you open.
 */

interface NavSpec {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
  count?: number;
}

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  orders: { title: "Orders", subtitle: "What to order, who carries it out, and by when" },
  map: { title: "Impact map", subtitle: "Modelled surge, wind and exposure" },
  shelters: { title: "Shelters", subtitle: "Register, compromised shelters, and unreached settlements" },
  evidence: { title: "Evidence", subtitle: "How far to trust the model, against satellite truth" },
};

export function AppShell(): JSX.Element {
  const [dark, setDark] = useState(false);
  const ledger = useOrderLedger();

  const match = useMatch("/scenarios/:runId/:section");
  const runId = match?.params.runId ?? null;
  const section = match?.params.section ?? "orders";
  const { data: scenario } = useRunData(runId);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const openOrders = scenario
    ? scenario.actions.filter((a) => !ledger.isOrdered(a.id)).length
    : 0;

  const nav: NavSpec[] = scenario
    ? [
        { to: `/scenarios/${runId}/orders`, label: "Orders", icon: "check", end: true, count: openOrders },
        { to: `/scenarios/${runId}/map`, label: "Map", icon: "clock", end: true },
        {
          to: `/scenarios/${runId}/shelters`,
          label: "Shelters",
          icon: "shelter",
          end: true,
          count: scenario.headline.sheltersCompromised,
        },
        { to: `/scenarios/${runId}/evidence`, label: "Evidence", icon: "satellite", end: true },
      ]
    : [];

  const page = scenario
    ? SECTION_TITLES[section] ?? SECTION_TITLES["orders"]
    : { title: "Storms", subtitle: "Open a precomputed run, or model a storm on demand" };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={text.sectionTitle}>PRAHARI</span>
        </NavLink>

        <nav className={styles.nav} aria-label="Sections">
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.navItemActive : styles.navItem)}>
            <Icon name="satellite" size={16} />
            <span className={text.body}>Storms</span>
          </NavLink>

          {scenario ? (
            <>
              <span className={`${text.label} ${styles.navLabel}`}>
                {scenario.meta.storm.toUpperCase()} · {scenario.meta.area.toUpperCase()}
              </span>
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? styles.navItemActive : styles.navItem)}
                >
                  <Icon name={item.icon} size={16} />
                  <span className={text.body}>{item.label}</span>
                  {item.count ? (
                    <span className={`${text.metric} ${styles.navCountAlert}`}>{item.count}</span>
                  ) : null}
                </NavLink>
              ))}
            </>
          ) : null}
        </nav>

        <div className={styles.sidebarFoot}>
          {scenario ? (
            <div className={styles.stormBlock}>
              <span className={styles.stormRow}>
                {/* Static, not pulsing: a replayed historical storm. livePulse exists for a live feed. */}
                <span className={`${statusDot} ${styles.stormDot}`} aria-hidden="true" />
                <span className={text.bodyStrong}>Cyclone {scenario.meta.storm}</span>
              </span>
              <span className={`${text.caption} ${styles.stormMeta}`}>
                {scenario.meta.area} · {scenario.meta.stageName}
              </span>
              <span className={`${text.clock} ${styles.stormClock}`}>T-{scenario.meta.nowHours}h</span>
              <span className={`${text.caption} ${styles.stormMeta}`}>
                Replay of a historical storm · engine output
              </span>
            </div>
          ) : null}

          <button
            type="button"
            className={`${text.caption} ${styles.themeToggle}`}
            onClick={() => {
              setDark((prev) => !prev);
            }}
            aria-pressed={dark}
          >
            {dark ? "Night control room" : "Day / projector"}
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.pageHeader}>
          <div className={styles.pageTitleGroup}>
            <h1 className={text.screenTitle}>{page?.title}</h1>
            <p className={`${text.caption} ${styles.pageSubtitle}`}>{page?.subtitle}</p>
          </div>
          {scenario ? (
            <span className={`${text.clock} ${styles.headerClock}`}>
              {new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(scenario.meta.nowIso))}{" "}
              IST
            </span>
          ) : null}
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type JSX } from "react";
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
  overview: { title: "Overview", subtitle: "What the model expects, where, and what to do next" },
  orders: { title: "Orders", subtitle: "What to order, who carries it out, and by when" },
  shelters: { title: "Shelters", subtitle: "Which shelters are unsafe, and who has no shelter place" },
  evidence: { title: "Can I trust it?", subtitle: "What was measured, what is heuristic, and the satellite check" },
};

export function AppShell(): JSX.Element {
  const [dark, setDark] = useState(false);
  const ledger = useOrderLedger();

  const match = useMatch("/scenarios/:runId/:section");
  const runId = match?.params.runId ?? null;
  const section = match?.params.section ?? "overview";
  const { data: scenario } = useRunData(runId);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // On a phone the sections are one scrolling row: keep the current one in view.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const row = navRef.current;
    if (active && row && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = active.offsetLeft - row.offsetLeft - 8;
    }
  }, [section, runId]);

  const openOrders = scenario
    ? scenario.actions.filter((a) => !ledger.isOrdered(a.id)).length
    : 0;

  const nav: NavSpec[] = scenario
    ? [
        { to: `/scenarios/${runId}/overview`, label: "Overview", icon: "clock", end: true },
        { to: `/scenarios/${runId}/orders`, label: "Orders", icon: "check", end: true, count: openOrders },
        {
          to: `/scenarios/${runId}/shelters`,
          label: "Shelters",
          icon: "shelter",
          end: true,
          ...(scenario.meta.coverage.shelters === "none" ? {} : { count: scenario.headline.sheltersCompromised }),
        },
        { to: `/scenarios/${runId}/evidence`, label: "Trust", icon: "satellite", end: true },
      ]
    : [];

  const page = scenario
    ? SECTION_TITLES[section] ?? SECTION_TITLES["overview"]
    : { title: "Cyclones", subtitle: "Pick a storm to see its flood, the orders it calls for, and the shelters at risk" };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand} aria-label="PRAHARI, all storms">
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={`${text.sectionTitle} ${styles.brandWord}`}>PRAHARI</span>
        </NavLink>

        <nav ref={navRef} className={styles.nav} aria-label="Sections">
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
            {scenario ? (
              <p className={`${text.caption} ${styles.mobileContext}`}>
                Cyclone {scenario.meta.storm} {scenario.meta.season} · {scenario.meta.area}
              </p>
            ) : null}
            <p className={`${text.caption} ${styles.pageSubtitle} ${scenario ? styles.wideOnly : ""}`}>
              {page?.subtitle}
            </p>
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

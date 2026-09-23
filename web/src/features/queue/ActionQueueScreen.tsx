import { assignInlineVars } from "@vanilla-extract/dynamic";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { Link } from "react-router-dom";

import { Callout } from "@/components/Callout";
import { DisclosureBadge } from "@/components/DisclosureBadge";
import { Icon, type IconName } from "@/components/Icon";
import { text } from "@/design/typography.css";
import { formatIST, useOrderLedger } from "@/features/orders/orderLedger";
import type { Action, ActionKind, ScenarioData } from "@/features/scenario/types";
import { useScenario } from "@/features/scenario/useScenario";

import { Briefing } from "./Briefing";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./ActionQueueScreen.css";

/**
 * THE HOME OF A RUN: its orders, in deadline order.
 *
 * The product converts IMD's bulletin into "what the Collector must order, by
 * which hour". So the first thing on screen is that list, and the primary
 * control is the tick that records an order. Everything else is the evidence
 * for the selected item, kept beside it.
 *
 * Keyboard: j / k move, o records. Officers who use this for the length of a
 * landfall should not need the mouse.
 */

const HOUR = 3_600_000;

type Urgency = "overdue" | "soon" | "due" | "done";

function urgency(action: Action, ordered: boolean, nowMs: number): Urgency {
  if (ordered) return "done";
  const dt = new Date(action.deadline).getTime() - nowMs;
  if (dt < 0) return "overdue";
  if (dt <= 12 * HOUR) return "soon";
  return "due";
}

function relative(deadline: string, nowMs: number): string {
  const dt = new Date(deadline).getTime() - nowMs;
  const hours = Math.round(Math.abs(dt) / HOUR);
  if (dt < 0) return `${hours}h overdue`;
  if (hours === 0) return "now";
  return `in ${hours}h`;
}

const KIND_ICON: Record<ActionKind, IconName> = {
  evacuate: "shelter",
  reassign: "compromised",
  staging: "clock",
  logistics: "check",
  verify: "satellite",
  finance: "check",
};

const KIND_LABEL: Record<ActionKind, string> = {
  evacuate: "Evacuate",
  reassign: "Reassign",
  staging: "Pre-position",
  logistics: "Logistics",
  verify: "Verify",
  finance: "Finance",
};

/** Map an evidence label to the server-backed limitations block for its badge. */
function limitationsFor(label: string, limits: ScenarioData["limitations"]) {
  const l = label.toLowerCase();
  if (l.includes("depth") || l.includes("surge")) return limits.surge;
  if (l.includes("payout") || l.includes("zone")) return limits.parametric;
  if (l.includes("distance") || l.includes("capacity") || l.includes("place") || l.includes("assigned") || l.includes("reason"))
    return limits.reachability;
  if (l.includes("flood cells") || l.includes("edge")) return limits.extent;
  return limits.exposure;
}

export function ActionQueueScreen(): JSX.Element {
  const scenario = useScenario();
  const { actions, meta } = scenario;
  const nowMs = useMemo(() => new Date(meta.nowIso).getTime(), [meta.nowIso]);
  const ledger = useOrderLedger();

  const sorted = useMemo(
    () =>
      [...actions].sort((a, b) => {
        const ao = ledger.isOrdered(a.id) ? 1 : 0;
        const bo = ledger.isOrdered(b.id) ? 1 : 0;
        if (ao !== bo) return ao - bo;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }),
    [actions, ledger],
  );

  const firstOpen = sorted.find((a) => !ledger.isOrdered(a.id));
  const [selectedId, setSelectedId] = useState<string>(firstOpen?.id ?? sorted[0]?.id ?? "");
  const selected = sorted.find((a) => a.id === selectedId) ?? sorted[0];

  const ordered = sorted.filter((a) => ledger.isOrdered(a.id)).length;
  const total = sorted.length;
  const pct = total ? Math.round((ordered / total) * 100) : 0;

  const toggleOrder = useCallback(
    (a: Action) => {
      ledger.toggle({ subjectId: a.id, action: a.title, stage: a.stage, byRole: a.owner });
    },
    [ledger],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = sorted.findIndex((a) => a.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        const next = sorted[Math.min(idx + 1, sorted.length - 1)];
        if (next) setSelectedId(next.id);
        e.preventDefault();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        const prev = sorted[Math.max(idx - 1, 0)];
        if (prev) setSelectedId(prev.id);
        e.preventDefault();
      } else if (e.key === "o" && selected) {
        toggleOrder(selected);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [sorted, selectedId, selected, toggleOrder]);

  const groups = useMemo(() => {
    const open = sorted.filter((a) => !ledger.isOrdered(a.id));
    const done = sorted.filter((a) => ledger.isOrdered(a.id));
    const byDeadline = new Map<string, Action[]>();
    for (const a of open) {
      const key = formatIST(a.deadline);
      byDeadline.set(key, [...(byDeadline.get(key) ?? []), a]);
    }
    return { byDeadline: [...byDeadline.entries()], done };
  }, [sorted, ledger]);

  const v = scenario.validation;
  // Orders rest on the modelled flood extent: say how far to trust it, here,
  // not only on the Evidence screen.
  const extentNote = v
    ? v.passed
      ? null
      : `Satellite validation of this flood extent failed (CSI ${v.csi.toFixed(3)} against Sentinel-1). Treat every order below as a recommendation to verify on the ground before it is issued.`
    : "This run's flood extent has not been validated against satellite truth. Treat every order below as a recommendation to verify on the ground before it is issued.";

  return (
    <>
    {extentNote ? (
      <Callout intent="warning" title="Orders rest on a heuristic flood extent">
        {extentNote}
      </Callout>
    ) : null}
    <div className={styles.screen}>
      <aside className={styles.list} aria-label="Order queue">
        <div className={styles.listHead}>
          <span className={`${text.label} ${styles.kind}`}>THIS STAGE · {meta.stageName.toUpperCase()}</span>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Orders recorded at this stage"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressFill} style={assignInlineVars({ [styles.pctVar]: `${pct}%` })} />
          </div>
          <div className={`${text.caption} ${styles.progressMeta}`}>
            <span>
              {ordered} of {total} ordered
            </span>
            <span>T-{meta.nowHours}h</span>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className={`${text.body} ${styles.progressMeta}`}>
            This run produced no orders: nothing in the modelled flood needs one.
          </p>
        ) : null}

        {groups.byDeadline.map(([when, items]) => (
          <div key={when} className={styles.group}>
            <div className={`${text.label} ${styles.groupTitle}`}>
              <span>BY {when.toUpperCase()}</span>
              <span className={styles.groupCount}>{items.length}</span>
            </div>
            {items.map((a) => (
              <QueueItem
                key={a.id}
                action={a}
                nowMs={nowMs}
                selected={a.id === selectedId}
                ordered={false}
                onSelect={() => {
                  setSelectedId(a.id);
                }}
                onToggle={() => {
                  toggleOrder(a);
                }}
              />
            ))}
          </div>
        ))}

        {groups.done.length > 0 ? (
          <div className={styles.group}>
            <div className={`${text.label} ${styles.groupTitle}`}>
              <span>ORDERED</span>
              <span className={styles.groupCount}>{groups.done.length}</span>
            </div>
            {groups.done.map((a) => (
              <QueueItem
                key={a.id}
                action={a}
                nowMs={nowMs}
                selected={a.id === selectedId}
                ordered
                onSelect={() => {
                  setSelectedId(a.id);
                }}
                onToggle={() => {
                  toggleOrder(a);
                }}
              />
            ))}
          </div>
        ) : null}
      </aside>

      {selected ? (
        <ActionDetail
          action={selected}
          scenario={scenario}
          nowMs={nowMs}
          runId={meta.runId}
          ordered={ledger.isOrdered(selected.id)}
          onToggle={() => {
            toggleOrder(selected);
          }}
        />
      ) : (
        <div className={styles.empty}>
          <Icon name="check" size={24} />
          <span className={text.screenTitle}>Every order for this stage is recorded.</span>
          <span className={text.body}>Next: Cyclone Warning stage opens at T-24h.</span>
        </div>
      )}
    </div>
    </>
  );
}

// -------------------------------------------------------------------------

function QueueItem({
  action,
  nowMs,
  selected,
  ordered,
  onSelect,
  onToggle,
}: {
  action: Action;
  nowMs: number;
  selected: boolean;
  ordered: boolean;
  onSelect: () => void;
  onToggle: () => void;
}): JSX.Element {
  const u = urgency(action, ordered, nowMs);
  const cls = selected ? styles.item.selected : ordered ? styles.item.ordered : styles.item.default;

  return (
    <div className={cls}>
      <input
        type="checkbox"
        className={styles.check}
        checked={ordered}
        aria-label={`Mark ordered: ${action.title}`}
        onChange={onToggle}
      />
      <button type="button" className={styles.itemBody} onClick={onSelect} aria-pressed={selected}>
        <span className={`${text.body} ${ordered ? styles.itemTitleOrdered : styles.itemTitle}`}>
          {action.title}
        </span>
        <span className={`${text.caption} ${styles.itemMeta}`}>
          <span className={`${text.metric} ${styles.deadline[u]}`}>
            {u === "done" ? "ordered" : relative(action.deadline, nowMs)}
          </span>
          <span>·</span>
          <span>{action.owner}</span>
          {action.people > 0 ? (
            <>
              <span>·</span>
              <span className={styles.people}>{action.people.toLocaleString("en-IN")} people</span>
            </>
          ) : null}
        </span>
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------

function ActionDetail({
  action,
  scenario,
  nowMs,
  runId,
  ordered,
  onToggle,
}: {
  action: Action;
  scenario: ScenarioData;
  nowMs: number;
  runId: string;
  ordered: boolean;
  onToggle: () => void;
}): JSX.Element {
  const ledger = useOrderLedger();
  const entry = ledger.get(action.id);
  const u = urgency(action, ordered, nowMs);

  return (
    <article className={styles.detail} aria-live="polite">
      <header className={styles.detailHead}>
        <span className={`${text.label} ${styles.kind}`}>
          {KIND_LABEL[action.kind].toUpperCase()} · {action.id}
        </span>
        <h2 className={styles.detailTitle}>{action.title}</h2>
        <div className={`${text.body} ${styles.detailMeta}`}>
          <span className={styles.metaItem}>
            <Icon name={KIND_ICON[action.kind]} size={14} />
            {action.owner}
          </span>
          <span className={`${text.clock} ${styles.metaItem} ${styles.deadline[u]}`}>
            <Icon name="clock" size={14} />
            by {formatIST(action.deadline)} IST ·{" "}
            {u === "done" ? "ordered" : relative(action.deadline, nowMs)}
          </span>
          {action.people > 0 ? (
            <span className={`${styles.metaItem} ${styles.people}`}>
              {action.people.toLocaleString("en-IN")} people
            </span>
          ) : null}
        </div>
      </header>

      <p className={`${text.body} ${styles.summary}`}>{action.summary}</p>

      <div className={styles.actionsRow}>
        <button type="button" className={ordered ? styles.primaryDone : styles.primary} onClick={onToggle}>
          <Icon name="check" size={14} />
          {ordered ? "Ordered" : "Record this order"}
        </button>
        {action.related.length > 0 ? (
          <Link to={`/scenarios/${runId}/shelters`} className={styles.secondary}>
            View shelters
          </Link>
        ) : null}
        {entry ? (
          <span className={`${text.caption} ${styles.orderedNote}`}>
            Recorded {formatIST(entry.orderedAt)} IST · {entry.byRole}
          </span>
        ) : null}
        <span className={`${text.caption} ${styles.kbdHint}`} aria-hidden="true">
          <kbd className={styles.kbd}>j</kbd>
          <kbd className={styles.kbd}>k</kbd> move
          <kbd className={styles.kbd}>o</kbd> order
        </span>
      </div>

      <section>
        <h3 className={`${text.label} ${styles.kind}`}>WHY THIS ORDER</h3>
        <dl className={styles.evidence}>
          {action.evidence.map((ev) => (
            <div key={ev.label} className={styles.evidenceItem}>
              <dt className={`${text.caption} ${styles.evidenceLabel}`}>{ev.label}</dt>
              <dd className={styles.evidenceValue}>
                <span className={text.bodyStrong}>{ev.value}</span>
                <DisclosureBadge state={ev.state} limitations={limitationsFor(ev.label, scenario.limitations)} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Briefing stage={action.stage} briefings={scenario.briefings} />

      <section>
        <h3 className={`${text.label} ${styles.kind}`}>WHERE</h3>
        <ImpactMap
          bbox={scenario.map.bbox}
          flood={scenario.map.flood}
          shelters={scenario.map.shelters}
          focus={action.focus}
          label={`Map of ${scenario.meta.area}: modelled flood depth and register shelters${action.focus ? `, centred on ${action.focus.label}` : ""}.`}
        />
      </section>
    </article>
  );
}

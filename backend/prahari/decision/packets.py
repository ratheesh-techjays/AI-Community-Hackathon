"""Role-addressed action packets per IMD stage.

Deterministic: every action is a template filled with numbers the engine
computed, and each carries the evidence it rests on. Gemini may later
rephrase a packet's narrative, never these items (PRD rule 2).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from prahari.decision.assignment import DETOUR_FACTOR, AssignmentResult
from prahari.exposure.grid_exposure import ShelterIndex
from prahari.hazard.holland import haversine_m
from prahari.models.results import (
    STAGE_HOURS,
    ActionItem,
    ActionKind,
    Evidence,
    IMDStage,
    PopulationCluster,
    Role,
    ShelterStatus,
    ZoneTrigger,
)

TOP_UNASSIGNED = 5


def _fmt(n: float) -> str:
    return f"{round(n):,}"


def mark_reassignments(
    shelters: list[ShelterStatus],
    clusters: list[PopulationCluster],
    result: AssignmentResult,
    index: ShelterIndex,
) -> None:
    """For each compromised shelter: how many people would normally go there,
    and where the optimiser sends most of them instead. Mutates `shelters`."""
    by_id = {s.register_id: s for s in shelters}
    for s in shelters:
        s.assigned_people = result.load.get(s.register_id, 0)
    received: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    per_cluster: dict[str, dict[str, int]] = defaultdict(dict)
    for a in result.assignments:
        per_cluster[a.population_cluster_id][a.shelter_register_id] = a.people
    for c in clusters:
        near = index.within(c.lat, c.lon, 200.0)[:1]
        if not near:
            continue
        home = by_id.get(index.shelters[near[0][0]].register_id)
        if home is None or home.status != "compromised":
            continue
        home.displaced_people += c.people_at_risk
        for target_id, people in per_cluster.get(c.cluster_id, {}).items():
            received[home.register_id][target_id] += people
    for home_id, targets in received.items():
        best_id, _ = max(targets.items(), key=lambda t: t[1])
        home, target = by_id[home_id], by_id[best_id]
        home.reassign_to = best_id
        home.reassign_to_name = target.name
        straight_m = float(haversine_m(home.lat, home.lon, target.lat, target.lon))
        home.reassign_distance_km = round(straight_m / 1000.0 * DETOUR_FACTOR, 1)


def _n(count: int, noun: str) -> str:
    """'1 shelter', '5 shelters'."""
    return f"{count} {noun}{'' if count == 1 else 's'}"


def _block(name: str | None) -> str:
    return (name or "unknown").title()


def build_actions(
    landfall_at: datetime,
    district_label: str,
    shelters: list[ShelterStatus],
    result: AssignmentResult,
    zones: list[ZoneTrigger],
    clusters: list[PopulationCluster],
) -> list[ActionItem]:
    items: list[ActionItem] = []
    cluster_by_id = {c.cluster_id: c for c in clusters}

    def add(
        stage: IMDStage,
        role: Role,
        kind: ActionKind,
        office: str,
        title: str,
        summary: str,
        subject: str,
        evidence: list[Evidence],
        people: int = 0,
        related: list[str] | None = None,
        focus: tuple[float, float, str] | None = None,
    ) -> None:
        hours = STAGE_HOURS[stage]
        items.append(
            ActionItem(
                sequence=len(items) + 1,
                subject_id=subject,
                kind=kind,
                role=role,
                stage=stage,
                office=office,
                title=title,
                summary=summary,
                people=people,
                related=related or [],
                focus_lat=focus[0] if focus else None,
                focus_lon=focus[1] if focus else None,
                focus_label=focus[2] if focus else None,
                deadline=landfall_at - timedelta(hours=hours),
                hours_before_landfall=hours,
                evidence=evidence,
            )
        )

    compromised = [s for s in shelters if s.status == "compromised"]
    watch = [s for s in shelters if s.status == "watch"]

    def collector(district: str | None) -> str:
        return f"District Collector, {(district or district_label).title()}"

    def by_district(rows: list[ShelterStatus]) -> list[tuple[str, list[ShelterStatus]]]:
        groups: dict[str, list[ShelterStatus]] = defaultdict(list)
        for row in rows:
            groups[row.district].append(row)
        return sorted(groups.items(), key=lambda t: -len(t[1]))

    gap = sum(u.people for u in result.unassigned)
    at_risk = sum(c.people_at_risk for c in clusters)
    usable_capacity = sum(s.capacity for s in shelters if s.status != "compromised")

    # T-72h: verify the shelter network against the modelled surge zone.
    for district, rows in by_district(compromised):
        deepest = max(rows, key=lambda s: s.depth_m or 0.0)
        in_district = sum(s.district == district for s in shelters)
        add(
            "PRE_CYCLONE_WATCH",
            "DISTRICT_COLLECTOR",
            "verify",
            collector(district),
            f"Withdraw {_n(len(rows), 'shelter')} inside the surge zone from the evacuation plan",
            f"{len(rows)} of {in_district} register shelters of {district.title()} in the "
            f"modelled area sit in flood cells. The deepest is {deepest.name} "
            f"({deepest.register_id}) at {deepest.depth_m} m. Confirm alternates with each BDO.",
            f"watch-compromised-shelters-{district}",
            [
                Evidence(
                    label="Shelters in flood cells",
                    value=f"{len(rows)} of {in_district}",
                    state="modelled",
                ),
                Evidence(
                    label="Deepest footprint", value=f"{deepest.depth_m} m", state="heuristic"
                ),
            ],
            related=[s.register_id for s in rows],
            focus=(deepest.lat, deepest.lon, deepest.name),
        )
    if result.unassigned:
        add(
            "PRE_CYCLONE_WATCH",
            "RELIEF_COMMISSIONER",
            "logistics",
            "Special Relief Commissioner, Odisha",
            f"Open temporary shelter for {_fmt(gap)} people beyond cyclone-shelter capacity",
            f"After optimal assignment, {_fmt(gap)} of {_fmt(at_risk)} people at risk have no "
            "cyclone-shelter place within 10 km. Schools and public buildings outside the "
            "flood are the usual fallback.",
            "watch-capacity-gap",
            [
                Evidence(label="People without a place", value=_fmt(gap), state="modelled"),
                Evidence(
                    label="Usable shelter capacity", value=_fmt(usable_capacity), state="modelled"
                ),
            ],
            people=gap,
            related=[u.population_cluster_id for u in result.unassigned],
        )

    # T-48h: block-level reassignment orders, one per compromised shelter.
    for s in sorted(compromised, key=lambda s: -s.displaced_people):
        if not s.reassign_to_name or not s.displaced_people:
            continue
        add(
            "CYCLONE_ALERT",
            "BLOCK_DEV_OFFICER",
            "reassign",
            f"BDO, {_block(s.block)} block ({s.district.title()})",
            f"Redirect {s.name} catchment to {s.reassign_to_name}",
            f"{s.name} ({s.register_id}) is inside the modelled flood at {s.depth_m} m. "
            f"{_fmt(s.displaced_people)} people live nearest to it; the optimiser sends most of "
            f"them to {s.reassign_to_name} ({s.reassign_to}), {s.reassign_distance_km} km away.",
            f"alert-reassign-{s.register_id}",
            [
                Evidence(label="Depth at footprint", value=f"{s.depth_m} m", state="heuristic"),
                Evidence(
                    label="People nearest to it", value=_fmt(s.displaced_people), state="modelled"
                ),
                Evidence(
                    label="Reassign distance",
                    value=f"{s.reassign_distance_km} km",
                    state="modelled",
                ),
            ],
            people=s.displaced_people,
            related=[r for r in (s.register_id, s.reassign_to) if r],
            focus=(s.lat, s.lon, s.name),
        )
    for u in result.unassigned[:TOP_UNASSIGNED]:
        c = cluster_by_id.get(u.population_cluster_id)
        depth = f"{c.max_depth_m} m" if c else "unknown"
        add(
            "CYCLONE_ALERT",
            "NDRF_STAGING",
            "staging",
            "NDRF team commander",
            f"Pre-position a team near {u.near} ({_block(u.block)})",
            f"{_fmt(u.people)} people near {u.near} have no shelter place. {u.why_infeasible}",
            f"alert-ndrf-{u.population_cluster_id}",
            [
                Evidence(label="People without a place", value=_fmt(u.people), state="modelled"),
                Evidence(label="Reason", value=u.reason.replace("_", " "), state="modelled"),
                Evidence(label="Max depth in cluster", value=depth, state="heuristic"),
            ],
            people=u.people,
            related=[u.population_cluster_id],
            focus=(c.lat, c.lon, u.near or u.population_cluster_id) if c else None,
        )

    # T-24h: evacuation orders by block, to optimiser-assigned shelters.
    clusters_by_block: dict[str, list[str]] = defaultdict(list)
    people_by_block: dict[str, int] = defaultdict(int)
    shelters_by_block: dict[str, set[str]] = defaultdict(set)
    for a in result.assignments:
        key = a.block or "UNKNOWN"
        people_by_block[key] += a.people
        clusters_by_block[key].append(a.population_cluster_id)
        shelters_by_block[key].add(a.shelter_register_id)
    for block, people in sorted(people_by_block.items(), key=lambda t: -t[1]):
        first = cluster_by_id.get(clusters_by_block[block][0])
        add(
            "CYCLONE_WARNING",
            "BLOCK_DEV_OFFICER",
            "evacuate",
            f"BDO, {_block(block)} block",
            f"Evacuate {_fmt(people)} people in {_block(block)} to assigned shelters",
            f"{_fmt(people)} people in {len(set(clusters_by_block[block]))} flood clusters of "
            f"{_block(block)} block have an assigned place in {len(shelters_by_block[block])} "
            "shelters outside the flood.",
            f"warning-evacuate-{block}",
            [
                Evidence(label="People assigned", value=_fmt(people), state="modelled"),
                Evidence(
                    label="Shelters used",
                    value=str(len(shelters_by_block[block])),
                    state="modelled",
                ),
            ],
            people=people,
            related=sorted(shelters_by_block[block]),
            focus=(first.lat, first.lon, _block(block)) if first else None,
        )
    for district, rows in by_district(watch):
        add(
            "CYCLONE_WARNING",
            "DISTRICT_COLLECTOR",
            "verify",
            collector(district),
            f"Post a watch officer at {_n(len(rows), 'shelter')} on the flood edge",
            f"{len(rows)} shelters in {district.title()} are dry in the model but a neighbouring "
            "cell floods. Be ready to move occupants if water reaches the plinth.",
            f"warning-watch-shelters-{district}",
            [Evidence(label="Shelters on the flood edge", value=str(len(rows)), state="modelled")],
            related=[s.register_id for s in rows],
        )

    # T-12h and after: liquidity, and keeping people out of the surge zone.
    triggered = [z for z in zones if z.triggered]
    if triggered:
        total = sum(z.payout_inr for z in triggered)
        crore = f"INR {total / 1e7:,.1f} crore"
        add(
            "POST_LANDFALL",
            "FINANCE_DRF",
            "finance",
            "State finance / DRF desk",
            f"Release {crore} under the parametric trigger (illustrative)",
            f"The dual trigger is crossed in {len(triggered)} block zones. Each pays the larger "
            "of its wind and flooded-population fractions of an illustrative limit.",
            "post-parametric-release",
            [
                Evidence(
                    label="Zones triggered",
                    value=f"{len(triggered)} of {len(zones)}",
                    state="modelled",
                ),
                Evidence(label="Payout (illustrative)", value=crore, state="modelled"),
            ],
            related=[z.zone_id for z in triggered],
        )
    for district, rows in by_district(compromised):
        add(
            "POST_LANDFALL",
            "DISTRICT_COLLECTOR",
            "verify",
            collector(district),
            f"Keep {_n(len(rows), 'flooded shelter')} closed until inspected",
            "Shelters inside the modelled flood may be structurally damaged or waterlogged. "
            "Reopen each only after an engineer's inspection.",
            f"post-keep-closed-{district}",
            [Evidence(label="Shelters in flood cells", value=str(len(rows)), state="modelled")],
            related=[s.register_id for s in rows],
        )
    return items

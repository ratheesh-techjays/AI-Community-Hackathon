"""L4 shelter assignment: OR-Tools min-cost flow, with a greedy baseline.

Network: cluster (supply = people) -> shelter (capacity) -> sink, plus a
penalised cluster -> sink "unassigned" arc so the problem is always
feasible. The penalty dominates distance, so the solver first maximises the
number of people sheltered, then minimises person-km.

Compromised shelters get no arcs: sending people INTO the surge zone is the
failure this layer exists to prevent. The greedy baseline is reported so
the optimiser has to earn its place (06-api-contracts.md, OptimiserReport).
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from ortools.graph.python import min_cost_flow

from prahari.exposure.grid_exposure import ShelterIndex
from prahari.models.results import (
    OptimiserReport,
    PopulationCluster,
    ShelterAssignment,
    ShelterStatus,
    UnassignedCluster,
)

DETOUR_FACTOR = 1.3  # straight line -> road distance, no road network yet
MAX_ROAD_KM = 10.0
EVACUATION_SPEED_KMH = 20.0
_COST_SCALE = 100  # person-km to integer cost units
_UNASSIGNED_PENALTY = 10_000_000


@dataclass(frozen=True)
class AssignmentResult:
    assignments: list[ShelterAssignment]
    unassigned: list[UnassignedCluster]
    report: OptimiserReport
    load: dict[str, int]  # register_id -> people assigned


def _arcs(
    clusters: list[PopulationCluster],
    shelters: list[ShelterStatus],
    index: ShelterIndex,
) -> tuple[dict[int, list[tuple[int, float]]], int, int]:
    by_register = {s.register_id: j for j, s in enumerate(shelters)}
    arcs: dict[int, list[tuple[int, float]]] = {}
    considered = filtered = 0
    radius = MAX_ROAD_KM / DETOUR_FACTOR
    for i, c in enumerate(clusters):
        feasible = []
        for k, straight_km in index.within(c.lat, c.lon, radius):
            j = by_register.get(index.shelters[k].register_id)
            if j is None:
                continue
            considered += 1
            s = shelters[j]
            if s.status == "compromised" or s.capacity <= 0:
                filtered += 1
                continue
            feasible.append((j, straight_km * DETOUR_FACTOR))
        arcs[i] = feasible
    return arcs, considered, filtered


def _greedy(
    clusters: list[PopulationCluster],
    shelters: list[ShelterStatus],
    arcs: dict[int, list[tuple[int, float]]],
) -> tuple[float, int]:
    remaining = [s.capacity for s in shelters]
    person_km = 0.0
    assigned = 0
    for i in sorted(range(len(clusters)), key=lambda i: -clusters[i].people_at_risk):
        need = clusters[i].people_at_risk
        for j, km in sorted(arcs[i], key=lambda t: t[1]):
            if need == 0:
                break
            take = min(need, remaining[j])
            if take:
                remaining[j] -= take
                need -= take
                person_km += take * km
                assigned += take
    return person_km, assigned


def assign(
    clusters: list[PopulationCluster],
    shelters: list[ShelterStatus],
    index: ShelterIndex,
) -> AssignmentResult:
    started = time.perf_counter()
    arcs, considered, filtered = _arcs(clusters, shelters, index)

    n_c, n_s = len(clusters), len(shelters)
    sink = n_c + n_s
    flow = min_cost_flow.SimpleMinCostFlow()
    arc_meta: dict[int, tuple[int, int, float]] = {}
    for i, feasible in arcs.items():
        people = clusters[i].people_at_risk
        for j, km in feasible:
            a = flow.add_arc_with_capacity_and_unit_cost(
                i, n_c + j, people, round(km * _COST_SCALE)
            )
            arc_meta[a] = (i, j, km)
        flow.add_arc_with_capacity_and_unit_cost(i, sink, people, _UNASSIGNED_PENALTY)
    for j, s in enumerate(shelters):
        if s.status != "compromised" and s.capacity > 0:
            flow.add_arc_with_capacity_and_unit_cost(n_c + j, sink, s.capacity, 0)
    total = sum(c.people_at_risk for c in clusters)
    for i, c in enumerate(clusters):
        flow.set_node_supply(i, c.people_at_risk)
    flow.set_node_supply(sink, -total)

    status = flow.solve() if total else flow.OPTIMAL
    solved = status == flow.OPTIMAL

    assignments: list[ShelterAssignment] = []
    load: dict[str, int] = {}
    sheltered = [0] * n_c
    person_km = 0.0
    if solved and total:
        for a, (i, j, km) in arc_meta.items():
            people = flow.flow(a)
            if people <= 0:
                continue
            s = shelters[j]
            sheltered[i] += people
            load[s.register_id] = load.get(s.register_id, 0) + people
            person_km += people * km
            assignments.append(
                ShelterAssignment(
                    population_cluster_id=clusters[i].cluster_id,
                    block=clusters[i].block,
                    people=people,
                    shelter_register_id=s.register_id,
                    shelter_name=s.name,
                    distance_km=round(km, 2),
                    travel_time_min=round(km / EVACUATION_SPEED_KMH * 60, 1),
                    capacity_utilisation=0.0,
                )
            )
        capacity = {s.register_id: s.capacity for s in shelters}
        for a in assignments:
            a.capacity_utilisation = round(
                load[a.shelter_register_id] / capacity[a.shelter_register_id], 3
            )

    unassigned = [
        _explain(c, c.people_at_risk - sheltered[i], arcs[i], shelters, index)
        for i, c in enumerate(clusters)
        if c.people_at_risk - sheltered[i] > 0
    ]

    greedy_km, greedy_assigned = _greedy(clusters, shelters, arcs)
    report = OptimiserReport(
        status="OPTIMAL" if solved else "INFEASIBLE",
        arcs_considered=considered,
        arcs_filtered=filtered,
        total_person_km=round(person_km, 1),
        greedy_person_km=round(greedy_km, 1),
        assigned_people=sum(sheltered),
        greedy_assigned_people=greedy_assigned,
        solve_ms=round((time.perf_counter() - started) * 1000),
    )
    assignments.sort(key=lambda a: (-a.people, a.population_cluster_id))
    unassigned.sort(key=lambda u: -u.people)
    return AssignmentResult(assignments, unassigned, report, load)


def not_run() -> AssignmentResult:
    """No shelter register covers the area: nothing is assigned, and nothing is
    reported as unassigned either, because no shelter was ever a candidate."""
    report = OptimiserReport(
        status="NOT_RUN",
        arcs_considered=0,
        arcs_filtered=0,
        total_person_km=0.0,
        greedy_person_km=0.0,
        assigned_people=0,
        greedy_assigned_people=0,
        solve_ms=0,
    )
    return AssignmentResult([], [], report, {})


def _explain(
    cluster: PopulationCluster,
    people: int,
    feasible: list[tuple[int, float]],
    shelters: list[ShelterStatus],
    index: ShelterIndex,
) -> UnassignedCluster:
    in_reach = index.within(cluster.lat, cluster.lon, MAX_ROAD_KM / DETOUR_FACTOR)
    nearest = index.within(cluster.lat, cluster.lon, 200.0)[:1]
    nearest_name = index.shelters[nearest[0][0]].name if nearest else None
    nearest_km = round(nearest[0][1] * DETOUR_FACTOR, 1) if nearest else None
    if feasible:
        reason = "capacity_exhausted"
        why = (
            f"All {len(feasible)} usable shelters within {MAX_ROAD_KM:.0f} km are full "
            "at their imputed capacity."
        )
    elif in_reach:
        reason = "all_shelters_compromised"
        why = (
            f"Every shelter within {MAX_ROAD_KM:.0f} km ({len(in_reach)}) is inside the "
            "modelled flood."
        )
    else:
        reason = "no_reachable_shelter"
        why = (
            f"No register shelter within {MAX_ROAD_KM:.0f} km (estimated road distance, "
            "straight line x 1.3)."
        )
    return UnassignedCluster(
        population_cluster_id=cluster.cluster_id,
        block=cluster.block,
        near=cluster.near,
        people=people,
        reason=reason,
        nearest_infeasible_shelter=nearest_name,
        nearest_distance_km=nearest_km,
        why_infeasible=why,
    )

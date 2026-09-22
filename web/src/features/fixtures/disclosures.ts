import type { DisclosureLimitations } from "@/components/DisclosureBadge";

/**
 * The canonical limitation blocks.
 *
 * ONE source of truth, mirroring the backend's `prahari/models/disclosure.py`.
 * When the API starts returning `ModelDisclosure`, these are replaced by the
 * server's own values — which is why the shapes are identical.
 */

export const SURGE: DisclosureLimitations = {
  method:
    "Holland (1980) parametric wind field, then an empirical surge index scaled by Bay of Bengal shelf geometry.",
  reason:
    "No published Bay-of-Bengal wind-to-surge formula exists; the operational literature is dynamical shallow-water modelling. This is an index, not a forecast, and it stays heuristic until that changes.",
  imd: "3.0–4.5 m",
  model: "surge-index v1",
  notCaptured: [
    "Tide phase and surge timing",
    "Wave setup and runup, often more than 1 m",
    "River discharge and compound flooding at the Mahanadi delta",
    "Embankment crests below 30 m DEM resolution",
  ],
  provenanceHref: "/provenance",
};

export const EXTENT: DisclosureLimitations = {
  method:
    "Connectivity-constrained bathtub inundation on Copernicus DEM GLO30_2024_1, flood-filled from the coastline so hydraulically disconnected basins do not flood.",
  reason:
    "Validated against Sentinel-1 observed extent for this storm and AOI, and cross-checked against Copernicus EMS EMSR357.",
  model: "inundation v1",
  notCaptured: [
    "Storm dynamics and surge timing",
    "DEM vertical error, comparable to the surge signal in low-relief terrain",
    "Urban double-bounce and paddy backscatter in the SAR truth itself",
  ],
  provenanceHref: "/provenance",
};

export const EXPOSURE: DisclosureLimitations = {
  method:
    "Google Open Buildings v3 footprints and WorldPop 100 m population, intersected with the modelled flood mask.",
  reason:
    "The hazard footprint it depends on is a heuristic index, and footprint detection density in rural coastal villages is unquantified.",
  model: "exposure v1",
  notCaptured: [
    "Building height, storeys and construction type",
    "Plinth elevation above ground level",
    "Population movement already under way",
  ],
  provenanceHref: "/provenance",
};

export const REACHABILITY: DisclosureLimitations = {
  method:
    "Shelter assignment by OR-Tools min-cost flow over the road network, filtered before solve: a shelter inside the surge zone or beyond the reachability rule is never offered.",
  reason:
    "Depends on the modelled flood extent and on OSM road completeness, which is patchy in rural Odisha.",
  model: "assignment v1",
  notCaptured: [
    "Road capacity and transport availability",
    "Shelter plinth height — a shelter is judged by footprint depth alone",
    "Whether a shelter is already occupied by an earlier evacuation",
  ],
  provenanceHref: "/provenance",
};

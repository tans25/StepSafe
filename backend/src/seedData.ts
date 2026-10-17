// PLACEHOLDER demo data. Locations are approximate guesses around UMD College Park
// and do NOT describe real sidewalk conditions. Replace with real spots when known.
export interface SeedReport {
  id: string;
  category: string;
  lat: number;
  lng: number;
  note: string;
  ageHours: number;
}

export const SEED_REPORTS: SeedReport[] = [
  { id: "rpt_seed_001", category: "construction_closure", lat: 38.9876, lng: -76.9419, note: "Sidewalk fenced off near a building entrance.", ageHours: 51 },
  { id: "rpt_seed_002", category: "pothole", lat: 38.9881, lng: -76.9437, note: "Deep pothole at the crosswalk edge.", ageHours: 20 },
  { id: "rpt_seed_003", category: "standing_water", lat: 38.9863, lng: -76.9445, note: "Puddle after rain covers most of the path.", ageHours: 6 },
  { id: "rpt_seed_004", category: "missing_curb_ramp", lat: 38.9890, lng: -76.9452, note: "No ramp at this corner.", ageHours: 300 },
  { id: "rpt_seed_005", category: "uneven_surface", lat: 38.9858, lng: -76.9431, note: "Raised paver edges, tripping risk.", ageHours: 120 },
  { id: "rpt_seed_006", category: "blocked_sidewalk", lat: 38.9872, lng: -76.9460, note: "Delivery vehicle parked across the walkway.", ageHours: 3 },
  { id: "rpt_seed_007", category: "uneven_surface", lat: 38.9848, lng: -76.9440, note: "Cracked slab, old report.", ageHours: 1100 },
  { id: "rpt_seed_008", category: "other", lat: 38.9895, lng: -76.9425, note: "Low-hanging branch over the path.", ageHours: 70 },
  { id: "rpt_seed_009", category: "construction_closure", lat: 38.9866, lng: -76.9410, note: "Detour signs, path partly closed.", ageHours: 200 },
  { id: "rpt_seed_010", category: "pothole", lat: 38.9854, lng: -76.9455, note: "Edge of pavement broken up.", ageHours: 800 },
];

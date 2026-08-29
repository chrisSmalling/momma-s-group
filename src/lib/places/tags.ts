// The places category_tags controlled vocabulary — verified live 2026-08-29
// (9 values, no more): playground (43), outdoor (43), indoor (28),
// animals (18), storytime (15), active_play (9), arts_learning (9),
// water_play (7), sensory_play (1). This is a coarse browse taxonomy, not
// specific-activity search — "gymnastics" isn't and won't be a tag here;
// that only ever comes from the free-text side of search_places(). Keep
// this list in sync with what ingestion actually assigns.
export interface PlaceCategoryTag {
  value: string;
  label: string;
}

export const PLACE_CATEGORY_TAGS: PlaceCategoryTag[] = [
  { value: "playground", label: "Playgrounds" },
  { value: "outdoor", label: "Outdoor" },
  { value: "indoor", label: "Indoor" },
  { value: "animals", label: "Animals" },
  { value: "storytime", label: "Storytime" },
  { value: "active_play", label: "Active play" },
  { value: "arts_learning", label: "Arts & learning" },
  { value: "water_play", label: "Water play" },
  { value: "sensory_play", label: "Sensory play" },
];

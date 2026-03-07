export type ResourceKind =
  | "pattern"
  | "instrument_preset"
  | "scene_skeleton"
  | "arrangement_skeleton"
  | "compound_bundle";

export type ResourcePermission = "read" | "import" | "sandbox_write" | "confirm_write";

export interface ResourceCatalogEntry {
  id: string;
  kind: ResourceKind;
  genre: string;
  roles: string[];
  energy: "low" | "medium" | "high";
  tempoRange: [number, number];
  keySupport: "fixed" | "transposable" | "drums";
  source: "built_in";
  liveRef: string;
  tags: string[];
  permissions: ResourcePermission[];
}

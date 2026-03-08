import type {
  GuidedChainId,
  GuidedContinuationId,
  GuidedFoundationId,
  GuidedGenreId,
  GuidedScopeId,
} from "./guided-starter.js";

type GuidedFoundationNode = {
  id: `foundation_${GuidedFoundationId}`;
  kind: "foundation";
  stepId: GuidedFoundationId;
  basePriority: number;
  resumeLabel: string;
  allowedScopes?: GuidedScopeId[];
};

type GuidedContinuationNode = {
  id: `continuation_${GuidedContinuationId}`;
  kind: "continuation";
  stepId: GuidedContinuationId;
  basePriority: number;
  resumeLabel: string;
  requiresAnyFoundation?: boolean;
  allowedScopes?: GuidedScopeId[];
};

type GuidedChainNode = {
  id: "chain_prompt";
  kind: "chain";
  label: string;
  basePriority: number;
  minReadyChains: number;
  allowedScopes?: GuidedScopeId[];
};

export type GuidedBuildNode = GuidedFoundationNode | GuidedContinuationNode | GuidedChainNode;

export const GUIDED_BUILD_GRAPH: Record<GuidedGenreId, GuidedBuildNode[]> = {
  house: [
    {
      id: "foundation_drums",
      kind: "foundation",
      stepId: "drums",
      basePriority: 30,
      resumeLabel: "Finish drums",
    },
    {
      id: "foundation_bassline",
      kind: "foundation",
      stepId: "bassline",
      basePriority: 20,
      resumeLabel: "Finish bassline",
    },
    {
      id: "foundation_chords",
      kind: "foundation",
      stepId: "chords",
      basePriority: 10,
      resumeLabel: "Finish chord groove",
    },
    {
      id: "continuation_verse_variation",
      kind: "continuation",
      stepId: "verse_variation",
      basePriority: 18,
      resumeLabel: "Finish Verse 2 + lead",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "continuation_build_drop",
      kind: "continuation",
      stepId: "build_drop",
      basePriority: 14,
      resumeLabel: "Finish build up + drop",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "continuation_intro_outro",
      kind: "continuation",
      stepId: "intro_outro",
      basePriority: 12,
      resumeLabel: "Finish intro + outro",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "chain_prompt",
      kind: "chain",
      label: "Chain scenes",
      basePriority: 8,
      minReadyChains: 1,
      allowedScopes: ["song"],
    },
  ],
  drum_n_bass: [
    {
      id: "foundation_drums",
      kind: "foundation",
      stepId: "drums",
      basePriority: 30,
      resumeLabel: "Finish drums",
    },
    {
      id: "foundation_bassline",
      kind: "foundation",
      stepId: "bassline",
      basePriority: 20,
      resumeLabel: "Finish bassline",
    },
    {
      id: "foundation_pads",
      kind: "foundation",
      stepId: "pads",
      basePriority: 10,
      resumeLabel: "Finish pad bed",
    },
    {
      id: "continuation_verse_variation",
      kind: "continuation",
      stepId: "verse_variation",
      basePriority: 18,
      resumeLabel: "Finish Verse 2 + lead",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "continuation_build_drop",
      kind: "continuation",
      stepId: "build_drop",
      basePriority: 14,
      resumeLabel: "Finish build up + drop",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "continuation_intro_outro",
      kind: "continuation",
      stepId: "intro_outro",
      basePriority: 12,
      resumeLabel: "Finish intro + outro",
      requiresAnyFoundation: true,
      allowedScopes: ["song"],
    },
    {
      id: "chain_prompt",
      kind: "chain",
      label: "Chain scenes",
      basePriority: 8,
      minReadyChains: 1,
      allowedScopes: ["song"],
    },
  ],
};

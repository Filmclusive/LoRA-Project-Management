import type { CaptionStatusReport, CharacterSummary, ProjectSummary } from "@filmclusive/orchestrator";

export type WorkflowStage =
  | { kind: "no_project" }
  | { kind: "no_character" }
  | { kind: "no_images" }
  | { kind: "needs_descriptions" }
  | { kind: "ready" };

export function getWorkflowStage(args: {
  projects: ProjectSummary[];
  activeProjectId: string;
  characters: CharacterSummary[];
  activeCharacterId: string;
  captionStatus: CaptionStatusReport | null;
}): WorkflowStage {
  if (args.projects.length === 0) return { kind: "no_project" };
  if (!args.activeProjectId) return { kind: "no_project" };
  if (args.characters.length === 0) return { kind: "no_character" };
  const activeCharacter = args.characters.find((c) => c.id === args.activeCharacterId) ?? null;
  if (!activeCharacter) return { kind: "no_character" };
  if (activeCharacter.image_count <= 0) return { kind: "no_images" };
  if (!args.captionStatus?.ok) return { kind: "needs_descriptions" };
  return { kind: "ready" };
}


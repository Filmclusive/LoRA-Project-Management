import { useCharacterContext } from "../../state/characterContext";
import { useProjectContext } from "../../state/projectContext";
import { CharacterWorkspace } from "./CharacterWorkspace";

export function CharactersPage(props: { onGoProjects: () => void }) {
  const { selectedProject } = useProjectContext();
  const { characters } = useCharacterContext();

  if (!selectedProject) {
    return (
      <div className="font-sans">
        <h2 className="text-base font-semibold text-[var(--fc-text)]">Characters</h2>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Select a project first.</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
          onClick={props.onGoProjects}
        >
          Go to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 min-w-0 font-sans">
      {characters.length === 0 ? (
        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 text-sm text-[var(--fc-text-muted)]">
          No characters yet. Use the <span className="font-semibold text-[var(--fc-text)]">+</span> button in the header to create one.
        </div>
      ) : (
        <CharacterWorkspace />
      )}
    </div>
  );
}

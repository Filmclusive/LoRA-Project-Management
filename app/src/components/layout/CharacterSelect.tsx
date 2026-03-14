import { useCharacterContext } from "../../state/characterContext";
import { useProjectContext } from "../../state/projectContext";

export function CharacterSelect(props: { onCreate: () => void }) {
  const { selectedProject } = useProjectContext();
  const { characters, selectedCharacterId, setSelectedCharacterId } = useCharacterContext();

  if (!selectedProject) return null;

  return (
    <div className="flex items-center gap-2 font-sans">
      <span className="hidden text-xs font-medium text-[var(--fc-text-muted)] sm:inline">Character</span>
      <select
        className="w-[200px] max-w-[46vw] rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)] disabled:opacity-60"
        value={selectedCharacterId}
        onChange={(e) => setSelectedCharacterId(e.currentTarget.value)}
        disabled={characters.length === 0}
        aria-label="Active character"
      >
        {characters.length === 0 ? <option value="">No characters</option> : null}
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
        onClick={props.onCreate}
        aria-label="Create new character"
        title="Create new character"
      >
        +
      </button>
    </div>
  );
}


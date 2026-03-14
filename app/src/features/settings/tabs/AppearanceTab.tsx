import { useUserPreferences, type ThemePreference } from "../../../state/userPreferences";

export function AppearanceTab() {
  const { preferences, updatePreferences } = useUserPreferences();

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
      <div className="text-sm font-semibold text-[var(--fc-text)]">Appearance</div>
      <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Choose a theme. Layout spacing stays consistent across modes.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(["system", "light", "dark"] as ThemePreference[]).map((t) => {
          const active = preferences.theme === t;
          return (
            <button
              key={t}
              type="button"
              className={[
                "rounded-2xl border p-4 text-left",
                active
                  ? "border-[var(--fc-border-strong)] bg-[var(--fc-panel)]"
                  : "border-[var(--fc-border)] bg-[var(--fc-panel)] hover:bg-[var(--fc-surface-hover)]",
              ].join(" ")}
              onClick={() => updatePreferences({ theme: t })}
            >
              <div className="text-sm font-semibold text-[var(--fc-text)]">{t === "system" ? "System" : t === "light" ? "Light" : "Dark"}</div>
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                {t === "system" ? "Match your OS setting." : t === "light" ? "Bright and clean." : "Calm and focused."}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

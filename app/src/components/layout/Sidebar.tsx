import type { ProjectSummary } from "@filmclusive/orchestrator";
import type { ReactNode } from "react";

import {
  Dumbbell,
  ExternalLink,
  FolderKanban,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Workflow,
} from "lucide-react";

import filmclusiveIcon from "../../assets/filmclusive-icon.png";

export type StudioSection = "projects" | "assets" | "prep" | "create" | "settings";

const NAV: Array<{ id: StudioSection; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "assets", label: "Assets" },
  { id: "prep", label: "Prep" },
  { id: "create", label: "Create" },
  { id: "settings", label: "Settings" },
];

const SECTION_ICONS: Record<StudioSection, ReactNode> = {
  projects: <FolderKanban className="h-6 w-6" aria-hidden />,
  assets: <Images className="h-6 w-6" aria-hidden />,
  prep: <Workflow className="h-6 w-6" aria-hidden />,
  create: <Dumbbell className="h-6 w-6" aria-hidden />,
  settings: <Settings className="h-6 w-6" aria-hidden />,
};

export function Sidebar(props: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  variant?: "docked" | "overlay";
  open?: boolean;
  onRequestClose?: () => void;
  section: StudioSection;
  onSectionChange: (next: StudioSection) => void;
  setupLocked: boolean;
  setupBypass: boolean;
  projects: ProjectSummary[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}) {
  const navItems = props.setupLocked && !props.setupBypass ? NAV.filter((it) => it.id === "settings") : NAV;
  const variant = props.variant ?? "docked";
  const overlayOpen = variant === "overlay" ? Boolean(props.open) : true;

  const aside = (
    <aside
      className={[
        "font-sans border-r border-[var(--fc-border)] bg-[var(--fc-sidebar)]",
        "h-full min-h-0",
        variant === "overlay" ? "w-[min(85vw,320px)] shadow-2xl" : "shrink-0",
        variant === "docked" ? (props.collapsed ? "w-16 md:w-[72px]" : "w-64 md:w-[280px] max-w-[80vw]") : "",
      ].join(" ")}
    >
      <div className="flex h-full flex-col justify-between gap-3 p-3">
        <div className="space-y-3">
          {props.collapsed ? (
            <button
              type="button"
              onClick={props.onToggleCollapsed}
              aria-label="Expand sidebar"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] text-[var(--fc-text)] shadow-[0_10px_25px_rgba(0,0,0,0.25)] transition hover:border-[var(--fc-border-strong)]"
            >
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 shadow-[0_10px_25px_rgba(0,0,0,0.25)]">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--fc-text)]">Studio</div>
                <div className="text-xs text-[var(--fc-text-muted)]">LoRA training</div>
              </div>
              <button
                type="button"
                onClick={props.onToggleCollapsed}
                aria-label="Collapse sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-text)] transition hover:border-[var(--fc-border-strong)]"
              >
                <PanelLeftClose className="h-5 w-5" aria-hidden />
              </button>
            </div>
          )}

          <nav className="flex flex-col gap-2">
            {navItems.map((it) => {
              const active = props.section === it.id;
              if (props.collapsed) {
                return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    props.onSectionChange(it.id);
                    props.onRequestClose?.();
                  }}
                  aria-label={it.label}
                  title={it.label}
                    className={[
                      "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                      active
                        ? "border-[var(--fc-nav-active-border)] bg-[var(--fc-nav-active-bg)] text-[var(--fc-nav-active-text)] shadow-[0_10px_20px_rgba(0,0,0,0.25)]"
                        : "border-[var(--fc-border)] bg-[var(--fc-panel)] text-[var(--fc-text-muted)] hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]",
                    ].join(" ")}
                  >
                    <span className="sr-only">{it.label}</span>
                    {SECTION_ICONS[it.id]}
                  </button>
                );
              }

              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    props.onSectionChange(it.id);
                    props.onRequestClose?.();
                  }}
                  className={[
                    "group flex items-center gap-3 rounded-2xl border px-2 py-2 transition",
                    active
                      ? "border-[var(--fc-nav-active-border)] bg-[var(--fc-nav-active-bg)] text-[var(--fc-nav-active-text)] shadow-[0_10px_20px_rgba(0,0,0,0.25)]"
                      : "border-transparent bg-transparent text-[var(--fc-text-muted)] hover:border-[var(--fc-border)] hover:bg-[var(--fc-panel)] hover:text-[var(--fc-text)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-12 w-12 items-center justify-center rounded-2xl border text-[var(--fc-text-muted)] transition",
                      active
                        ? "border-[var(--fc-nav-active-border)] bg-[var(--fc-nav-active-bg)] text-[var(--fc-nav-active-text)]"
                        : "border-[var(--fc-border)] bg-[var(--fc-panel)] group-hover:border-[var(--fc-border-strong)] group-hover:text-[var(--fc-text)]",
                    ].join(" ")}
                  >
                    <span className="sr-only">{it.label}</span>
                    {SECTION_ICONS[it.id]}
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        <a
          href="https://filmclusive.com"
          target="_blank"
          rel="noreferrer"
          className={[
            "rounded-2xl border border-dashed border-[var(--fc-border)] bg-transparent text-[var(--fc-text-muted)] transition hover:border-[var(--fc-accent)] hover:text-[var(--fc-accent)]",
            props.collapsed ? "mx-auto flex h-12 w-12 items-center justify-center" : "flex items-center gap-3 p-3",
          ].join(" ")}
          aria-label="Visit Filmclusive"
        >
          <img
            src={filmclusiveIcon}
            alt=""
            className={[
              "rounded-xl border border-[var(--fc-border)] bg-[#05050b] object-cover",
              props.collapsed ? "h-7 w-7" : "h-10 w-10",
            ].join(" ")}
            aria-hidden
          />
          {props.collapsed ? null : (
            <>
              <span className="text-sm font-medium text-[var(--fc-text)]">Filmclusive</span>
              <ExternalLink className="ml-auto h-4 w-4" aria-hidden />
            </>
          )}
        </a>
      </div>
    </aside>
  );

  if (variant === "overlay") {
    return (
      <div
        className={["fixed inset-0 z-40", overlayOpen ? "pointer-events-auto" : "pointer-events-none"].join(" ")}
        aria-hidden={!overlayOpen}
      >
        <button
          type="button"
          className={[
            "absolute inset-0 bg-black/60 transition-opacity",
            overlayOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-label="Close navigation"
          onClick={() => props.onRequestClose?.()}
        />
        <div
          className={[
            "absolute left-0 top-0 h-full transform transition-transform duration-200",
            overlayOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          {aside}
        </div>
      </div>
    );
  }

  return aside;
}

import type { ReactNode } from "react";

export type BreadcrumbItem = { label: string; onClick?: () => void };

export function Breadcrumb(props: { items: BreadcrumbItem[]; right?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <nav className="min-w-0 text-sm text-[var(--fc-text-muted)]">
        <ol className="flex min-w-0 items-center gap-2">
          {props.items.map((it, idx) => {
            const isLast = idx === props.items.length - 1;
            const base =
              "min-w-0 truncate " +
              (it.onClick && !isLast ? "cursor-pointer text-[var(--fc-text)] hover:underline" : "");
            return (
              <li key={`${it.label}-${idx}`} className="flex min-w-0 items-center gap-2">
                <span className={base} onClick={it.onClick}>
                  {it.label}
                </span>
                {!isLast ? <span className="text-[var(--fc-text-faint)]">/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}


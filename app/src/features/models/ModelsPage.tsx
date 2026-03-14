import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { exportModel, listAssetModels, listAssets, type AssetModelSummary, type AssetSummary } from "@filmclusive/orchestrator";
import { useProjectContext } from "../../state/projectContext";

type AssetTabId =
  | "characters"
  | "props"
  | "wardrobe"
  | "setDeck"
  | "camera"
  | "lighting"
  | "hairMakeup"
  | "vfx"
  | "look"
  | "other";

const MODEL_TABS: Array<{ id: AssetTabId; label: string; assetTypes: string[] }> = [
  { id: "characters", label: "Characters", assetTypes: ["actor"] },
  { id: "props", label: "Props", assetTypes: ["prop"] },
  { id: "wardrobe", label: "Wardrobe", assetTypes: ["costume"] },
  { id: "setDeck", label: "Set Deck", assetTypes: ["set"] },
  { id: "camera", label: "Camera", assetTypes: ["camera", "lens"] },
  { id: "lighting", label: "Lighting", assetTypes: ["lighting"] },
  { id: "hairMakeup", label: "Hair & Makeup", assetTypes: ["hair-makeup"] },
  { id: "vfx", label: "VFX", assetTypes: ["vfx"] },
  { id: "look", label: "Look", assetTypes: ["look"] },
  { id: "other", label: "Other", assetTypes: [] },
];

function formatWhen(iso?: string | null) {
  if (!iso) return "Not yet";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return value.toLocaleString();
}

function matchesTab(asset: AssetSummary, tabId: AssetTabId) {
  const tab = MODEL_TABS.find((item) => item.id === tabId);
  if (!tab) return false;
  if (tab.assetTypes.length === 0) {
    return !MODEL_TABS.some((item) => item.id !== "other" && item.assetTypes.includes(asset.asset_type));
  }
  return tab.assetTypes.includes(asset.asset_type);
}

export function ModelsPage() {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [modelsByAsset, setModelsByAsset] = useState<Record<string, AssetModelSummary[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assetTab, setAssetTab] = useState<AssetTabId>("characters");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  async function safeOpenPath(path: string, label = "Open") {
    const target = path.trim();
    if (!target) return;
    try {
      await openPath(target);
    } catch (nextError) {
      setError(`${label} failed: ${String(nextError)}`);
    }
  }

  async function safeRevealItem(path: string, label = "Reveal") {
    const target = path.trim();
    if (!target) return;
    try {
      await revealItemInDir(target);
    } catch {
      await safeOpenPath(target, label);
    }
  }

  useEffect(() => {
    if (!selectedProjectId) {
      setAssets([]);
      setModelsByAsset({});
      return;
    }
    setLoading(true);
    setError("");
    listAssets({ projectId: selectedProjectId })
      .then(async (nextAssets) => {
        setAssets(nextAssets);
        const entries = await Promise.all(
          nextAssets.map(async (asset) => [asset.id, await listAssetModels({ projectId: selectedProjectId, assetId: asset.id })] as const),
        );
        setModelsByAsset(Object.fromEntries(entries));
      })
      .catch((nextError) => setError(String(nextError)))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const filteredAssets = useMemo(() => assets.filter((asset) => matchesTab(asset, assetTab)).sort((a, b) => a.name.localeCompare(b.name)), [assets, assetTab]);

  useEffect(() => {
    if (!filteredAssets.length) {
      setSelectedAssetId("");
      return;
    }
    if (!filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0]!.id);
    }
  }, [filteredAssets, selectedAssetId]);

  const visibleModels = useMemo(() => {
    if (!selectedAssetId) {
      return filteredAssets.flatMap((asset) => (modelsByAsset[asset.id] ?? []).map((model) => ({ asset, model })));
    }
    const asset = filteredAssets.find((item) => item.id === selectedAssetId);
    if (!asset) return [];
    return (modelsByAsset[asset.id] ?? []).map((model) => ({ asset, model }));
  }, [filteredAssets, modelsByAsset, selectedAssetId]);

  if (!selectedProject) {
    return (
      <div className="font-sans">
        <h2 className="text-base font-semibold text-[var(--fc-text)]">Models</h2>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Select a project to view trained models.</p>
      </div>
    );
  }

  return (
    <div className="font-sans">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--fc-text)]">Models</h2>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Models are grouped by build tab so props, wardrobe, set deck, and character LoRAs all live in their own lanes.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {MODEL_TABS.map((tab) => {
          const active = tab.id === assetTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={[
                "rounded-xl px-3 py-2 text-sm font-medium",
                active
                  ? "bg-[var(--fc-surface)] text-[var(--fc-text)]"
                  : "bg-[var(--fc-panel)] text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
              ].join(" ")}
              onClick={() => setAssetTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px,1fr]">
          <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="models-asset">
              Asset
            </label>
            <select
              id="models-asset"
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)]"
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.currentTarget.value)}
              disabled={filteredAssets.length === 0}
            >
              {filteredAssets.length === 0 ? <option value="">No assets in this tab yet</option> : null}
              {filteredAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            <div className="mt-3 text-sm text-[var(--fc-text-muted)]">
              {selectedAssetId ? "Showing models for the selected asset." : "Choose an asset or switch tabs to browse a different department."}
            </div>
          </div>

          <div>
            {error ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-danger)]">{error}</div>
            ) : null}

            {loading ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">Refreshing models…</div>
            ) : null}

            {!loading && visibleModels.length === 0 ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
                No models in this tab yet.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visibleModels.map(({ asset, model }) => (
                <div key={model.id} className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--fc-text)]">{asset.name}</div>
                      <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
                        {asset.asset_type} • {asset.model_family} • {model.version}
                      </div>
                    </div>
                    <span className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-xs font-semibold text-[var(--fc-text-muted)]">
                      {model.status}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-[var(--fc-text-muted)]">{formatWhen(model.trained_at)}</div>
                  <div className="mt-2 break-words text-xs text-[var(--fc-text-muted)]">
                    {model.artifacts[0]?.path ?? "Model artifact not found yet."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.run_dir ? (
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                        onClick={() => void safeOpenPath(model.run_dir!, "Open run folder")}
                      >
                        Open run folder
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                      disabled={!model.artifacts[0]?.path}
                      onClick={async () => {
                        if (!model.artifacts[0]?.path) return;
                        try {
                          await navigator.clipboard.writeText(model.artifacts[0].path);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Copy model path
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                      disabled={!selectedProjectId}
                      onClick={async () => {
                        if (!selectedProjectId) return;
                        const chosenRoot = await openDialog({ directory: true, multiple: false, title: "Choose export folder" });
                        if (!chosenRoot || Array.isArray(chosenRoot)) return;
                        try {
                          const outputPath = await exportModel({
                            projectId: selectedProjectId,
                            assetId: asset.id,
                            modelId: model.id,
                            destinationRoot: chosenRoot,
                            destinationMode: "copy",
                          });
                          await safeRevealItem(outputPath, "Reveal export");
                        } catch (nextError) {
                          setError(String(nextError));
                        }
                      }}
                    >
                      Export model
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

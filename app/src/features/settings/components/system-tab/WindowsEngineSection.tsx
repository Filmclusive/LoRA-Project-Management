import { useEffect, useState } from "react";
import {
  bootstrapEngine,
  getSdScriptsReport,
  getSystemStatus,
  installPytorch,
  installSdScripts,
  writeAccelerateConfig,
  type BootstrapReport,
  type InstallPytorchReport,
  type InstallSdScriptsReport,
  type SdScriptsReport,
  type SystemStatusReport,
} from "@filmclusive/orchestrator";

interface WindowsEngineSectionProps {
  platform: string;
  statusKind: string;
}

export function WindowsEngineSection({ platform, statusKind }: WindowsEngineSectionProps) {
  const [systemStatus, setSystemStatus] = useState<SystemStatusReport | null>(null);
  const [bootstrapReport, setBootstrapReport] = useState<BootstrapReport | null>(null);
  const [booting, setBooting] = useState(false);
  const [sdScriptsReport, setSdScriptsReport] = useState<SdScriptsReport | null>(null);
  const [sdScriptsInstall, setSdScriptsInstall] = useState<InstallSdScriptsReport | null>(null);
  const [installingSdScripts, setInstallingSdScripts] = useState(false);
  const [writingAccelerateConfig, setWritingAccelerateConfig] = useState(false);
  const [installingPytorch, setInstallingPytorch] = useState(false);
  const [pytorchInstallReport, setPytorchInstallReport] = useState<InstallPytorchReport | null>(null);
  const [pytorchChannel, setPytorchChannel] = useState<"stable" | "nightly">("stable");
  const [pytorchCudaTag, setPytorchCudaTag] = useState<"cu128" | "cu126" | "cu124" | "cu121" | "cpu">("cu128");

  const gpuReport = systemStatus?.gpu ?? null;
  const torchSupportedArchList = gpuReport?.torchSupportedArchList ?? null;
  const firstDevice = gpuReport?.devices?.[0] ?? null;
  const requiredSm =
    firstDevice?.computeCapabilityMajor != null && firstDevice?.computeCapabilityMinor != null
      ? `sm_${firstDevice.computeCapabilityMajor}${firstDevice.computeCapabilityMinor}`
      : null;
  const torchArchMismatch =
    Boolean(requiredSm) && Array.isArray(torchSupportedArchList) ? !torchSupportedArchList.includes(requiredSm!) : false;

  useEffect(() => {
    if (!gpuReport) return;
    const cuda = (gpuReport.torchCudaVersion ?? "").toLowerCase().replace(".", "");
    if (cuda.includes("128")) setPytorchCudaTag("cu128");
    else if (cuda.includes("126")) setPytorchCudaTag("cu126");
    else if (cuda.includes("124")) setPytorchCudaTag("cu124");
    else if (cuda.includes("121")) setPytorchCudaTag("cu121");
    if (torchArchMismatch) {
      setPytorchChannel("nightly");
      if (requiredSm?.startsWith("sm_12")) setPytorchCudaTag("cu128");
    }
  }, [gpuReport, torchArchMismatch, requiredSm]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const report = await getSystemStatus();
        if (!mounted) return;
        setSystemStatus(report);
      } catch {
        if (!mounted) return;
        setSystemStatus(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [platform]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const report = await getSdScriptsReport();
        if (!mounted) return;
        setSdScriptsReport(report);
      } catch {
        if (!mounted) return;
        setSdScriptsReport(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [platform]);

  if (platform !== "windows") return null;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--fc-text)]">Windows throughput engine</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            This is the pinned local runtime for multi-GPU training. It expects an offline wheelhouse for dependency installs.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
          disabled={booting || statusKind === "loading"}
          onClick={async () => {
            setBooting(true);
            setBootstrapReport(null);
            try {
              const report = await bootstrapEngine();
              setBootstrapReport(report);
              try {
                const refreshed = await getSystemStatus();
                setSystemStatus(refreshed);
              } catch {
                // ignore
              }
            } catch (e) {
              setBootstrapReport({ ok: false, steps: [String(e)], gpus: null });
            } finally {
              setBooting(false);
            }
          }}
        >
          {booting ? "Bootstrapping…" : "Bootstrap engine"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Install root</div>
          <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
            {systemStatus?.config?.install_root ?? "Not available"}
          </div>
          <div className="mt-3 text-xs text-[var(--fc-text-muted)]">
            Engine: {systemStatus?.config?.engine_root ?? "Unknown"}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">GPU (PyTorch)</div>
          <div className="mt-1 text-sm text-[var(--fc-text)]">
            {systemStatus?.gpu?.cuda_available
              ? `${systemStatus.gpu.device_count} GPU${systemStatus.gpu.device_count === 1 ? "" : "s"}`
              : systemStatus?.gpu
                ? (systemStatus.gpu.torch_version?.includes("+cpu")
                    ? "CPU-only PyTorch (install CUDA build)"
                    : "CUDA not available")
                : "Not checked"}
          </div>
          <div className="mt-2 space-y-1 text-xs text-[var(--fc-text-muted)]">
            <div>
              Torch: <span className="font-semibold text-[var(--fc-text)]">{systemStatus?.gpu?.torch_version ?? "Unknown"}</span>
              {systemStatus?.gpu?.torchCudaVersion ? (
                <>
                  {" "}
                  (CUDA{" "}
                  <span className="font-semibold text-[var(--fc-text)]">{systemStatus.gpu.torchCudaVersion}</span>)
                </>
              ) : null}
            </div>
            {requiredSm ? (
              <div>
                GPU arch: <span className="font-semibold text-[var(--fc-text)]">{requiredSm}</span>
                {torchSupportedArchList?.length ? (
                  <>
                    {" "}
                    · Torch supports{" "}
                    <span className="font-semibold text-[var(--fc-text)]">{torchSupportedArchList.join(" ")}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {torchArchMismatch ? (
            <div className="mt-3 rounded-xl border border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] p-3 text-xs text-[var(--fc-warning)]">
              This GPU needs <span className="font-semibold">{requiredSm}</span>, but the installed PyTorch build doesn&apos;t include it.
              Install a newer (usually nightly) PyTorch build below.
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-xs text-[var(--fc-text)]"
              value={pytorchChannel}
              onChange={(e) => setPytorchChannel(e.target.value === "nightly" ? "nightly" : "stable")}
            >
              <option value="stable">PyTorch stable</option>
              <option value="nightly">PyTorch nightly</option>
            </select>
            <select
              className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-xs text-[var(--fc-text)]"
              value={pytorchCudaTag}
              onChange={(e) => setPytorchCudaTag((e.target.value as typeof pytorchCudaTag) || "cu128")}
            >
              <option value="cu128">CUDA 12.8</option>
              <option value="cu126">CUDA 12.6</option>
              <option value="cu124">CUDA 12.4</option>
              <option value="cu121">CUDA 12.1</option>
              <option value="cpu">CPU-only</option>
            </select>
            <button
              type="button"
              className="rounded-lg bg-[var(--fc-accent)] px-2 py-1 text-xs font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              disabled={installingPytorch || statusKind === "loading"}
              onClick={async () => {
                setInstallingPytorch(true);
                setPytorchInstallReport(null);
                try {
                  const report = await installPytorch({ channel: pytorchChannel, cuda: pytorchCudaTag });
                  setPytorchInstallReport(report);
                  try {
                    const refreshed = await getSystemStatus();
                    setSystemStatus(refreshed);
                  } catch {
                    // ignore
                  }
                } catch (e) {
                  setPytorchInstallReport({
                    ok: false,
                    steps: [String(e)],
                    index_url: "",
                    gpu: null,
                  });
                } finally {
                  setInstallingPytorch(false);
                }
              }}
            >
              {installingPytorch ? "Installing…" : "Install / Repair PyTorch"}
            </button>
          </div>
          {pytorchInstallReport?.steps?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--fc-text-muted)]">
              {pytorchInstallReport.steps.slice(0, 6).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              <div>Accelerate config: {systemStatus?.config?.accelerate_config_path ?? "Unknown"}</div>
              {systemStatus?.checks ? (
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    systemStatus.checks.accelerate_config_exists
                      ? "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]"
                      : "border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] text-[var(--fc-warning)]",
                  ].join(" ")}
                >
                  {systemStatus.checks.accelerate_config_exists ? "Ready" : "Missing"}
                </span>
              ) : null}
              {systemStatus?.checks && !systemStatus.checks.accelerate_config_exists ? (
                <button
                  type="button"
                  className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-[11px] font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={writingAccelerateConfig || statusKind === "loading"}
                  onClick={async () => {
                    setWritingAccelerateConfig(true);
                    try {
                      await writeAccelerateConfig();
                      const refreshed = await getSystemStatus();
                      setSystemStatus(refreshed);
                    } catch {
                      // ignore
                    } finally {
                      setWritingAccelerateConfig(false);
                    }
                  }}
                >
                  {writingAccelerateConfig ? "Writing…" : "Write config"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-[var(--fc-text)]">Training scripts (sd-scripts)</div>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-xs font-semibold",
                  sdScriptsReport?.ok
                    ? "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]"
                    : "border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] text-[var(--fc-warning)]",
                ].join(" ")}
              >
                {sdScriptsReport?.ok ? "Ready" : "Missing"}
              </span>
            </div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">Required for training on Windows. Install once and training will work.</div>
            {sdScriptsReport?.sd_scripts_dir ? (
              <div className="mt-2 break-words text-xs text-[var(--fc-text-muted)]">
                Location: <span className="font-semibold text-[var(--fc-text)]">{sdScriptsReport.sd_scripts_dir}</span>
              </div>
            ) : null}
            {sdScriptsReport && !sdScriptsReport.ok ? (
              <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
                Missing:{" "}
                <span className="font-semibold text-[var(--fc-text)]">
                  {sdScriptsReport.flux_train_network_py ? null : "flux_train_network.py "}
                  {sdScriptsReport.sdxl_train_network_py ? null : "sdxl_train_network.py"}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              disabled={installingSdScripts || statusKind === "loading"}
              onClick={async () => {
                setInstallingSdScripts(true);
                setSdScriptsInstall(null);
                try {
                  const report = await installSdScripts();
                  setSdScriptsInstall(report);
                  try {
                    const refreshed = await getSdScriptsReport();
                    setSdScriptsReport(refreshed);
                  } catch {
                    // ignore
                  }
                } finally {
                  setInstallingSdScripts(false);
                }
              }}
            >
              {installingSdScripts ? "Installing…" : "Install training scripts"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              disabled={installingSdScripts || statusKind === "loading"}
              onClick={async () => {
                try {
                  const refreshed = await getSdScriptsReport();
                  setSdScriptsReport(refreshed);
                } catch {
                  setSdScriptsReport(null);
                }
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {sdScriptsInstall?.steps?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
            {sdScriptsInstall.steps.slice(0, 8).map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {bootstrapReport?.steps?.length ? (
        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text)]">
          <div className="text-sm font-semibold">{bootstrapReport.ok ? "Bootstrap complete" : "Bootstrap failed"}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
            {bootstrapReport.steps.slice(0, 8).map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

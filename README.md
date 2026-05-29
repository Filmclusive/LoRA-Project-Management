# Filmclusive Character Capture (Character LoRA Training)

A film-focused **LoRA training wrapper** designed to make *Character LoRA training* feel invisible to creatives.

This project orchestrates dataset validation, captioning, preset configuration, and reproducible training runs while delegating the actual learning to `kohya-ss/sd-scripts`.

- Does **not** modify training internals
- Adds **guardrails**, **repeatability**, and **production-safe workflows**
- Keeps **hyperparameters hidden** behind opinionated presets

## What You Can Capture (Train)

Although the primary use case is **Character Capture**, the same workflow supports training LoRAs for:

- **Characters** (face, body, silhouette, movement “read”)
- **Wardrobe continuity** (signature outfits, fabrics, costumes)
- **Props** (hero objects, handheld items, tools, weapons, accessories)
- **Set design** (locations, rooms, production design motifs)
- **Lighting styles** (cinematic lighting looks, practicals, contrast ratios)
- **Era / art direction styles** (period texture, palette, design language)

## Philosophy

This is not a research lab. It is a creative appliance.

- Zero CLI usage for end users
- Strict preset-based configuration (no exposed knobs)
- Reproducible model versioning (every run is auditable)
- Offline-first operation

## Architecture

```text
[Tauri UI]
 ↓
[Orchestrator Layer]
 ↓
[Python Runner]
 ↓
[kohya sd-scripts]
```

We do not rewrite training code. We orchestrate it.

## Repository Structure

```text
/apps/train
 /app → Tauri frontend
 /orchestrator → Project lifecycle logic
 /dataset-tools → Preflight validation
 /auto-caption → Caption generation + normalization
 /presets → Hidden training configs
 /runner → Python execution layer
 /vendor/kohya → sd-scripts submodule
 /runs → Versioned output models
```

## Training Workflow

### 1) Create a Project

User selects:

- Project name
- Dataset folder
- Preset type

Example presets:

- Character – Close Portrait
- Character – Full Body
- Wardrobe Consistency
- Prop Capture
- Cinematic Lighting Style
- Era / Art Direction Style

Hyperparameters are never shown.

### 2) Dataset Preflight (Guardrails)

The system validates:

- Image count + resolution consistency
- Duplicate detection
- Pose / framing diversity
- Lighting variation
- Face visibility (for character presets)

Output is qualitative and production-oriented (not ML jargon).

### 3) Caption Pipeline

Pipeline steps:

- Auto-generate captions
- Normalize tags
- Inject film vocabulary bias
- Allow manual edits
- Save finalized captions

#### Sidecar metadata (v1+)

Each dataset image can have an adjacent `*.meta.json` that stores structured visual intelligence.

- Training captions (`*.txt`) are deterministically generated from sidecar metadata + preset rules
- The structured JSON is **not** fed directly into training

### 4) Config Generation

The orchestrator generates:

```text
/runs/{project}/v001/train_config.json
```

Config snapshot includes:

- Preset-defined hyperparameters
- Seed
- Dataset + output paths
- `kohya` commit hash

### 5) Training Execution

The runner executes:

```bash
python runner/filmclusive_runner.py train --run-dir /path/to/run
```

Then calls `sd-scripts` through `accelerate` using the generated config:

```bash
python -m accelerate.commands.launch vendor/kohya/sdxl_train_network.py --config_file kohya_config.toml
```

Logs stream to the UI.

### 6) Versioned Outputs (No Overwrites)

Each run creates a versioned folder:

```text
/runs/{project}/v001/
 model.safetensors
 config_snapshot.json
 dataset_manifest.json
 preset_used.json
 training_log.txt
```

Versions auto-increment. No overwrite allowed.

## Reproducibility Policy

Every run stores:

- Full config snapshot
- Dataset file hash manifest
- Random seed
- Preset identifier
- `kohya` commit hash
- Timestamp

This makes training rerunnable, reviewable, and safe to ship in production workflows.

## Design Constraints (Intentional)

Do not:

- Expose rank, alpha, LR, or schedulers
- Modify `vendor/kohya` training internals
- Allow manual CLI access as the “primary UX”
- Add advanced ML toggles
- Let UI bypass the orchestrator

This is a professional capture system, not an experimentation playground.

## Engine Setup (SDXL LoRA)

This wrapper trains SDXL LoRA weights by orchestrating `vendor/kohya` (`sd-scripts`).

### Install / update the submodule

```bash
git submodule update --init --recursive
```

We do not modify `kohya` in v1; we pin a stable commit and snapshot it per run.

### Environment requirements

- macOS (primary target)
- Python 3.11 (handled by the app setup flow, or bundled in a DMG)
- NVIDIA GPU recommended
- CUDA-compatible drivers
- 8GB+ VRAM recommended for character presets

#### Windows offline wheelhouse (throughput edition)

- Windows bootstrap is designed to run offline after initial sync
- Put an offline wheelhouse at `C:\\Filmclusive\\engine\\wheels` (see `docs/wheelhouse.md`)

## Internal API Surface (High Level)

UI → Orchestrator

- `createProject()`
- `getPreflightResults()`
- `approveCaptions()`
- `startTraining()`
- `subscribeToLogs()`
- `listModelVersions()`

Orchestrator → Runner

- `generateConfig()`
- `executeTraining()`
- `streamLogs()`

Runner → `kohya`

- Call `train_network.py` with the generated config
- Stream stdout
- Capture exit code

## Strategic Positioning (Resume-Friendly)

Filmclusive Character Capture is designed to feel like:

- A digital double builder
- A wardrobe/prop continuity system
- A style capture tool for production workflows

Not:

- A Reddit LoRA workflow
- An ML research environment
- A hyperparameter lab

## Troubleshooting (Windows downloads)

If a managed download fails with `Windows certificate revocation check failed (SChannel)`, set `FILMCLUSIVE_CURL_SSL_NO_REVOKE=1` and retry. This makes the app pass `curl --ssl-no-revoke` for downloads on Windows.

## Distribution & Releases

Packaging, release automation, and instructions for splitting `/apps/train` into its own repository live in `DISTRIBUTING.md`.

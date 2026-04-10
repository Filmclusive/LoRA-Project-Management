Filmclusive Character Capture

Filmclusive Character Capture is a film-focused LoRA training wrapper designed to make model training invisible to creatives.

This system orchestrates dataset validation, captioning, preset configuration, and reproducible training runs while delegating all learning operations to kohya-ss sd-scripts.

It does not modify training internals.
It provides guardrails, repeatability, and production-safe workflows.

⸻

Philosophy

This project is not a research lab.

It is a creative appliance.

Goals:
	•	Zero CLI usage for end users
	•	No exposed hyperparameters
	•	Strict preset-based configuration
	•	Reproducible model versioning
	•	Clean project structure
	•	Offline-first operation

⸻

Architecture Overview

[Tauri UI]
     ↓
[Orchestrator Layer]
     ↓
[Python Runner]
     ↓
[kohya sd-scripts]

We do not rewrite training code.

We orchestrate it.

⸻

Repository Structure

/filmclusive-lora
  /app                → Tauri frontend
  /orchestrator       → Project lifecycle logic
  /dataset-tools      → Preflight validation
  /auto-caption       → Caption generation + normalization
  /presets            → Hidden training configs
  /runner             → Python execution layer
  /vendor/kohya       → sd-scripts submodule
  /runs               → Versioned output models


⸻

Installing kohya as a Submodule

We vendor kohya as a Git submodule.

From project root:

git submodule add https://github.com/kohya-ss/sd-scripts vendor/kohya
git commit -m "Add kohya sd-scripts as submodule"

When cloning:

git clone --recurse-submodules <repo-url>

If already cloned:

git submodule update --init --recursive

To pin a stable commit:

cd vendor/kohya
git checkout <commit_hash>
cd ../..
git commit -am "Pin kohya version"

We do not modify kohya in v1.

⸻

Environment Requirements
	•	macOS (primary target)
	•	Python 3.11 (handled automatically by the app setup flow, or bundled in DMG)
	•	NVIDIA GPU recommended
	•	CUDA-compatible drivers
	•	8GB+ VRAM recommended for character presets

Windows offline wheelhouse (throughput edition)
	• Windows bootstrap is designed to run offline after initial sync.
	• Put an offline wheelhouse at `C:\Filmclusive\engine\wheels` (see `docs/wheelhouse.md`).

Offline-first.
All dependencies must install locally.

⸻

Training Engine Setup (SDXL LoRA)

This wrapper trains SDXL LoRA weights by orchestrating `vendor/kohya` (`sd-scripts`).

1) Add the submodule (already included if you cloned with submodules)

	git submodule update --init --recursive

2) Recommended for users: in-app automatic setup

	In the app:
	• Open **Engine setup**
	• Click **Set up automatically**
	• Wait for setup to finish and then click **Check environment**
	• Set **SDXL base model** to your local SDXL checkpoint or Diffusers directory

3) Optional manual setup (for development)

	python3.11 -m venv .venv
	./.venv/bin/python -m pip install --upgrade pip
	./.venv/bin/pip install -r vendor/kohya/requirements.txt
	# macOS (MPS) / CPU:
	./.venv/bin/pip install torch torchvision

	# Linux/Windows (NVIDIA CUDA): install CUDA-enabled wheels from the PyTorch index
	# (example channel; choose the best match for your driver/GPU)
	./.venv/bin/pip install --index-url https://download.pytorch.org/whl/cu124 torch torchvision
	•	Set **Python executable** to `./.venv/bin/python`

Notes:
	•	Managed base model installs (for example FLUX) may download model files from Hugging Face when you click Install in Engine setup. You can change the download location there.
	•	All other model paths you provide (for example SDXL) are local files/directories you manage.
	•	The app will create per-run `kohya_config.toml` and `dataset_config.toml` snapshots for reproducibility.

Bundled runtime for DMG (non-technical users):
	• Prepare a runtime folder containing `bin/python3` plus installed deps.
	• Copy it into bundle resources:

	./scripts/prepare_bundled_python.sh /absolute/path/to/python-runtime-root

	• Build DMG normally; the app auto-detects bundled runtime from `app/src-tauri/resources/python-runtime`.

One-command DMG build automation:
	• Build with explicit runtime path:

	pnpm build:dmg -- /absolute/path/to/python-runtime-root

	• Or set an environment variable and build:

	export FILMCLUSIVE_PYTHON_RUNTIME=/absolute/path/to/python-runtime-root
	pnpm run build:dmg:env

⸻

Training Workflow

1. Create Project

User selects:
	•	Project name
	•	Dataset folder
	•	Preset type

Presets include:
	•	Character – Close Portrait
	•	Character – Full Body
	•	Wardrobe Consistency
	•	Prop Capture
	•	Cinematic Lighting Style
	•	Era Style

Hyperparameters are never shown.

⸻

2. Dataset Preflight

System validates:
	•	Image count
	•	Resolution consistency
	•	Duplicate detection
	•	Pose diversity
	•	Lighting variation
	•	Face visibility (if character preset)

User receives qualitative feedback only.

⸻

3. Caption Pipeline

Process:
	•	Auto-generate captions
	•	Normalize tags
	•	Inject film vocabulary bias
	•	Allow manual edits
	•	Save finalized captions

Sidecar metadata (v1+)
	•	Each dataset image can have an adjacent `*.meta.json` file that stores structured visual intelligence.
	•	Training captions (`*.txt`) are deterministically generated from the sidecar metadata + preset rules.
	•	The structured JSON is not fed directly into training.

⸻

4. Config Generation

Orchestrator generates:

/runs/{project}/v001/train_config.json

Config includes:
	•	Preset-defined hyperparameters
	•	Seed
	•	Dataset path
	•	Output path
	•	kohya commit hash

User does not see config internals.

⸻

5. Training Execution

Runner executes:

python runner/filmclusive_runner.py train --run-dir /path/to/run

Runner then calls:

python -m accelerate.commands.launch vendor/kohya/sdxl_train_network.py --config_file kohya_config.toml

Logs stream to UI.

⸻

6. Versioned Output

Each run creates:

/runs/{project}/v001/
    model.safetensors
    config_snapshot.json
    dataset_manifest.json
    preset_used.json
    training_log.txt

Versions auto-increment.

No overwrite allowed.

⸻

API Surface (Internal)

UI → Orchestrator
	•	createProject()
	•	getPreflightResults()
	•	approveCaptions()
	•	startTraining()
	•	subscribeToLogs()
	•	listModelVersions()

Orchestrator → Runner
	•	generateConfig()
	•	executeTraining()
	•	streamLogs()

Runner → kohya
	•	Call train_network.py with generated config
	•	Stream stdout
	•	Capture exit code

⸻

Reproducibility Policy

Every run must store:
	•	Full config snapshot
	•	Dataset file hash manifest
	•	Random seed
	•	Preset identifier
	•	kohya commit hash
	•	Timestamp

This ensures model auditability and re-trainability.

⸻

Design Constraints

Do NOT:
	•	Expose rank, alpha, LR, scheduler
	•	Modify kohya training internals
	•	Allow manual CLI access
	•	Add advanced ML toggles
	•	Let UI bypass orchestrator

We are building a professional capture system, not an experimentation playground.

⸻

Future Expansion (Not in v1)
	•	Auto sample grid generation
	•	Prompt stress testing
	•	Cloud training fallback
	•	Multi-character blending
	•	Evaluation scoring system
	•	Film-aware training heuristics

⸻

Strategic Positioning

Filmclusive Character Capture is designed to feel like:

A digital double builder
A wardrobe consistency system
A style capture tool

Not:

A Reddit LoRA workflow
An ML research environment
A hyperparameter lab

The product should feel production-safe and repeatable.

⸻

Contribution Guidelines
	•	All changes must preserve separation of concerns
	•	Do not modify vendor/kohya directly
	•	Presets must remain opinionated
	•	UI must never surface ML terminology
	•	All runs must produce version snapshots

⸻

License

Check kohya sd-scripts license for compatibility.
Ensure Filmclusive wrapper licensing does not conflict with upstream dependencies.

⸻

Troubleshooting (Windows downloads)

If a managed download fails with a message like `Windows certificate revocation check failed (SChannel)`, set the environment variable `FILMCLUSIVE_CURL_SSL_NO_REVOKE=1` and retry. This makes the app pass `curl --ssl-no-revoke` for downloads on Windows.

⸻

## Distribution & releases

Packaging, release automation, and instructions for splitting `/apps/train` into its own repository live in `DISTRIBUTING.md`. Follow that guide to keep installers out of Git, publish `.dmg`/`.app` assets via GitHub Releases, and share the app from `Filmclusive/LoRA-Project-Management` or a similar repo.

# Packaging & releasing the Train app

This folder is the active source for the macOS/Windows Train app. When you need to share just this app (for example, from `Filmclusive/LoRA-Project-Management`) or publish installers, follow the steps below instead of committing large build outputs to `main`.

## Split the Train code into its own repo

1. Decide whether to copy the folders you need or export them with `git subtree`.
   * Minimal contents: `apps/train`, `workers/train-scripts`, and any shared `docs`
   * Copy method: create a fresh repo (`Filmclusive/LoRA-Project-Management`), then `rsync -a apps/train workers/train-scripts README.md ...` and commit.
   * Subtree method (preserves history):
     ```bash
     git subtree split -P apps/train -b train-only
     git remote add train-git https://github.com/Filmclusive/LoRA-Project-Management.git
     git push train-git train-only:main --force
     ```
     Do the same for `workers/train-scripts` if you want its history in the same repo (or copy the scripts manually).

2. In the standalone repository, keep `.gitignore` entries for `app/src-tauri/target/`, `app/node_modules/`, `dist/`, and `!workers/train-scripts/dist/` so build artifacts stay out of Git.

3. If needed, re-run `pnpm install` inside `apps/train/app` and `workers/train-scripts` so the new repo has a clean dependency tree.

## Trim working tree before exporting

Before zipping the directories or running `git subtree split`, clean any generated files so the directory you share stays small:

```bash
pnpm -C app tauri clean      # clears Tauri / Cargo build output
rm -rf app/src-tauri/target  # drop the 5+ GB release bundles left on disk
rm -rf app/node_modules app/dist
rm -rf workers/train-scripts/dist installers
```

If you rebuild immediately after a clean, run `pnpm install` once per workspace to regenerate only the files you actually need.

## Build mac installers with a bundled Python runtime

1. Prepare a Python runtime (3.11) with the dependencies listed inside `workers/train-scripts/prepare_wheelhouse.py` or `vendor/kohya/requirements.txt`. The runtime should expose `bin/python3`.
2. Copy the runtime into the app bundle:
   ```bash
   ./workers/train-scripts/prepare_bundled_python.sh /absolute/path/to/python-runtime-root
   ```
3. Build the DMG (and any other bundles you need) with:
   ```bash
   FILMCLUSIVE_PYTHON_RUNTIME=/absolute/path/to/python-runtime-root pnpm -C app run build:dmg:env
   # or allow the script to ask for the env variable
   pnpm -C app run build:dmg
   ```
   This runs `pnpm -C app tauri build --bundles dmg` after the runtime has been copied into `app/src-tauri/resources/python-runtime`.
4. A `.dmg` lands in `app/src-tauri/target/release/bundle/dmg/` and a `.app` is placed in `app/src-tauri/target/release/bundle/macos/`.

## Collect release assets

After building, run `workers/train-scripts/collect_installers.sh`. It copies every `.dmg` and `.exe` from `src-tauri/target/release/bundle/*` into `workers/train-scripts/dist/installers/$VERSION` and now zips the macOS `.app` too:

```bash
./workers/train-scripts/collect_installers.sh
```

If the script runs on macOS, it uses `ditto` to archive `$PRODUCT_NAME.app`. On other platforms it falls back to `zip`. The output folder is safe to drop into a release and contains: `*.dmg`, `*.exe`, and `*.app.zip`.

## Publish installers via GitHub Releases

1. Tag the workspace and push the tag to GitHub:
   ```bash
   git tag -am "Train v$(node -p "require('./apps/train/app/src-tauri/tauri.conf.json').version")" vX.Y.Z
   git push origin --tags
   ```
2. On `https://github.com/Filmclusive/LoRA-Project-Management` (or whichever repo you push the `apps/train` code into), create a release and upload:
   * The `.dmg` or `.exe` (from `workers/train-scripts/target/release/bundle/*`).
   * The zipped `.app` (`workers/train-scripts/dist/installers/$VERSION/$PRODUCT_NAME.app.zip`).
3. Reference the release in your README and mention the bundled runtime so non-technical users can download/install without running npm or Python commands.

**Do not commit `.dmg`/`.app` binaries to Git.** Releases are the correct home for installers so the Git history remains small.

## Optional Windows build path

When you need an NSIS `.exe`, run the helper:
```bash
pnpm -C app run build:exe
```
It only succeeds on Windows. Then re-run `workers/train-scripts/collect_installers.sh` to gather the newest `.exe` alongside the macOS artifacts.

## Summary

| Artifact | Source | Destination |
| --- | --- | --- |
| `.dmg` | `app/src-tauri/target/release/bundle/dmg/` | Release asset |
| `.app` | `app/src-tauri/target/release/bundle/macos/LoRA Trainer.app` | `workers/train-scripts/dist/installers/$VERSION/LoRA Trainer.app.zip` then release asset |
| `.exe` | `app/src-tauri/target/release/bundle/nsis/` | Release asset |

Share the installers from `workers/train-scripts/dist/installers/$VERSION`. Because the repo never stores the binaries, cloning, CI, and subsequent exports stay under a few hundred megabytes.

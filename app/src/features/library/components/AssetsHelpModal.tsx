import { Modal } from "../../../components/ui/Modal";

interface AssetsHelpModalProps {
  open: boolean;
  onClose: () => void;
  onCreateAsset: () => void;
}

export function AssetsHelpModal({ open, onClose, onCreateAsset }: AssetsHelpModalProps) {
  return (
    <Modal
      open={open}
      size="lg"
      title="What are assets?"
      description="Assets are reusable building blocks for consistency in a project."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={onCreateAsset}
          >
            Create an asset
          </button>
        </>
      }
    >
      <div className="space-y-4 font-sans text-sm text-[var(--fc-text)]">
        <p>
          An asset can be a person, a character look, a prop, a set, or a style you want to reuse. Think of it like a
          labeled bin for reference material that belongs together.
        </p>

        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-sm font-semibold">Examples</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
            <li>Actor: headshots and wardrobe variations for the same person</li>
            <li>Prop: the same item in different lighting and angles</li>
            <li>Set: the same location across time of day and coverage</li>
            <li>Look: a visual style, color palette, or film stock vibe</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-sm font-semibold">How training works</div>
          <p className="mt-2 text-sm text-[var(--fc-text-muted)]">
            When you add images and train, you get a LoRA. A LoRA is a small add-on model that helps the generator
            remember what makes this asset consistent, so you can recreate it across new shots and scenes.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-sm font-semibold">A practical starting point</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
            <li>Start with 10 to 40 images for most assets</li>
            <li>More images can help, up to around 100, if they stay on the same subject or style</li>
            <li>Include variety: angles, focal lengths, lighting setups, and backgrounds</li>
            <li>Keep it focused: avoid mixing different characters or multiple props in one asset</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}


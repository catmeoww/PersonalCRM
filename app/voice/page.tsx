import { VoiceCapture } from './VoiceCapture';

export default function VoicePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Voice note</h1>
        <p className="text-sm text-slate-500">
          Say a contact&apos;s name or their kid&apos;s name, then what you learned. Tap the right match to save.
        </p>
      </header>
      <VoiceCapture />
    </div>
  );
}

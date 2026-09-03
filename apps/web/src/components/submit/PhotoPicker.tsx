import { Camera, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useRef, useState } from 'react';
import { Button } from '../ui/Button.tsx';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Camera-first photo picker. Compresses on the device before upload so a 12 MP
 * phone photo does not become a slow multi-megabyte request on party wifi.
 */
export function PhotoPicker({
  onChange,
  error,
}: {
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 3,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      const finalFile =
        compressed.size <= MAX_UPLOAD_BYTES
          ? new File([compressed], 'entry.jpg', { type: compressed.type || 'image/jpeg' })
          : null;
      if (!finalFile) {
        setProblem('That photo is still too large. Try taking a new one.');
        onChange(null);
        return;
      }
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(finalFile);
      });
      onChange(finalFile);
    } catch {
      // Formats the browser cannot decode (some HEIC) land here; the raw file
      // still works if it is small enough, and the server re-encodes it.
      if (file.size <= MAX_UPLOAD_BYTES) {
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(file);
        });
        onChange(file);
      } else {
        setProblem('Could not read that photo. Try taking a new one with your camera.');
        onChange(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">Photo</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        A clear, well-lit shot of the whole dish. Taken with your phone camera is perfect.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {preview ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-black/10">
          <img src={preview} alt="Your entry" className="aspect-4/3 w-full object-cover" />
          <div className="flex justify-center bg-surface p-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Take a different photo
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/20 bg-white/60 px-4 py-8 text-ink-muted hover:border-accent-600 hover:text-accent-700"
        >
          <Camera className="size-8" aria-hidden="true" />
          <span className="font-semibold">
            {busy ? 'Preparing photo…' : 'Take or choose a photo'}
          </span>
          <span className="text-xs">JPEG, PNG or HEIC. We shrink it for you.</span>
        </button>
      )}

      {(problem ?? error) ? (
        <p className="mt-1 text-xs font-medium text-red-700">{problem ?? error}</p>
      ) : null}
    </div>
  );
}

import {
  PHOTO_ACCEPT_ATTRIBUTE,
  PHOTO_INPUT_FORMAT_LIST,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
} from '@contest/shared';
import { Camera, ImageIcon, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useRef, useState } from 'react';
import { Button } from '../ui/Button.tsx';

/**
 * Camera-first photo picker.
 *
 * Shrinking on the device keeps a 12 MP phone photo from becoming a slow
 * multi-megabyte request on party wifi, but it is only an optimisation: it runs
 * through a canvas, so it fails on any format the browser itself cannot decode
 * (HEIC outside Safari, most obviously). When it fails the original file is
 * uploaded untouched and the API converts it, which is why nothing here rejects
 * a file for its type.
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
  const [previewBroken, setPreviewBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function accept(file: File) {
    setPreviewBroken(false);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    onChange(file);
  }

  function reject(message: string) {
    setProblem(message);
    onChange(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 3,
        maxWidthOrHeight: PHOTO_MAX_EDGE,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      if (compressed.size > PHOTO_MAX_BYTES) {
        reject('That photo is still too large. Try taking a new one.');
        return;
      }
      accept(new File([compressed], 'entry.jpg', { type: compressed.type || 'image/jpeg' }));
    } catch {
      // The browser could not decode it. Send it as it came and let the server
      // do the conversion, as long as it fits within the upload limit.
      if (file.size <= PHOTO_MAX_BYTES) accept(file);
      else reject('That photo is too large. Try taking a new one with your camera.');
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
        accept={PHOTO_ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {preview ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-black/10">
          {previewBroken ? (
            // Safari-only formats such as HEIC reach here: the file uploads and
            // converts fine, this browser just cannot draw it.
            <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 bg-white/60 text-ink-muted">
              <ImageIcon className="size-8" aria-hidden="true" />
              <span className="text-sm font-semibold">Photo ready to upload</span>
            </div>
          ) : (
            <img
              src={preview}
              alt="Your entry"
              className="aspect-4/3 w-full object-cover"
              onError={() => setPreviewBroken(true)}
            />
          )}
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
          <span className="text-xs">{PHOTO_INPUT_FORMAT_LIST}. We shrink it for you.</span>
        </button>
      )}

      {(problem ?? error) ? (
        <p className="mt-1 text-xs font-medium text-red-700">{problem ?? error}</p>
      ) : null}
    </div>
  );
}

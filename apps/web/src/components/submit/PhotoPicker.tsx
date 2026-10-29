import {
  PHOTO_ACCEPT_ATTRIBUTE,
  PHOTO_INPUT_FORMAT_LIST,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
} from '@contest/shared';
import { Camera, Crop, ImageIcon, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useRef, useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { cropToFile, loadImage } from './cropImage.ts';
import { PhotoCropper, type SquareCrop } from './PhotoCropper.tsx';

/** A shrunken photo the browser can draw, kept so the crop can be redone. */
interface Source {
  file: File;
  url: string;
  image: HTMLImageElement;
}

/**
 * Camera-first photo picker.
 *
 * Shrinking on the device keeps a 12 MP phone photo from becoming a slow
 * multi-megabyte request on party wifi, but it is only an optimisation: it runs
 * through a canvas, so it fails on any format the browser itself cannot decode
 * (HEIC outside Safari, most obviously). When it fails the original file is
 * uploaded untouched and the API converts it, which is why nothing here rejects
 * a file for its type.
 *
 * Every screen shows entries as a square, so once the browser can draw the photo
 * the guest picks that square themselves before it is used. A photo it cannot
 * draw skips that step and is centred by whatever shows it.
 */
export function PhotoPicker({
  onChange,
  error,
  noun = 'entry',
}: {
  onChange: (file: File | null) => void;
  error?: string;
  /** What is being photographed: "dish", "costume". */
  noun?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<SquareCrop | undefined>();

  function replaceSource(next: Source | null) {
    setSource((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return next;
    });
  }

  function clearPreview() {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

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
    setCropping(false);
    replaceSource(null);
    clearPreview();
    onChange(null);
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
      const shrunk = new File([compressed], 'entry.jpg', {
        type: compressed.type || 'image/jpeg',
      });
      const url = URL.createObjectURL(shrunk);
      try {
        replaceSource({ file: shrunk, url, image: await loadImage(url) });
        setCrop(undefined);
        setCropping(true);
      } catch {
        URL.revokeObjectURL(url);
        accept(shrunk);
      }
    } catch {
      // The browser could not decode it. Send it as it came and let the server
      // do the conversion, as long as it fits within the upload limit.
      if (file.size <= PHOTO_MAX_BYTES) accept(file);
      else reject('That photo is too large. Try taking a new one with your camera.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCrop(chosen: SquareCrop) {
    if (!source) return;
    setCrop(chosen);
    setCropping(false);
    try {
      accept(await cropToFile(source.image, chosen));
    } catch {
      // A browser that drew the photo but cannot export a canvas: use it whole.
      accept(source.file);
    }
  }

  function chooseAnother() {
    setCropping(false);
    replaceSource(null);
    inputRef.current?.click();
  }

  return (
    <div>
      <p className="text-sm font-semibold">Photo</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        A clear, well-lit shot of the whole {noun}. Taken with your phone camera is perfect.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          // Lets the same file be picked again after "Choose another".
          event.target.value = '';
        }}
      />

      {cropping && source ? (
        <PhotoCropper
          src={source.url}
          width={source.image.naturalWidth}
          height={source.image.naturalHeight}
          initial={crop}
          onConfirm={(chosen) => void confirmCrop(chosen)}
          onCancel={chooseAnother}
        />
      ) : preview ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-black/10">
          {previewBroken ? (
            // Safari-only formats such as HEIC reach here: the file uploads and
            // converts fine, this browser just cannot draw it.
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-white/60 text-ink-muted">
              <ImageIcon className="size-8" aria-hidden="true" />
              <span className="text-sm font-semibold">Photo ready to upload</span>
            </div>
          ) : (
            <img
              src={preview}
              alt="Your entry"
              className="aspect-square w-full object-cover"
              onError={() => setPreviewBroken(true)}
            />
          )}
          <div className="flex flex-wrap justify-center gap-2 bg-surface p-2">
            {source ? (
              <Button variant="secondary" size="sm" onClick={() => setCropping(true)}>
                <Crop className="size-4" aria-hidden="true" />
                Adjust
              </Button>
            ) : null}
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

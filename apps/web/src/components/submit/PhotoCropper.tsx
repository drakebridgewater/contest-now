import { Check, Move } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Button } from '../ui/Button.tsx';

/** A square region of the source image, in its own pixels. */
export interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

const MAX_ZOOM = 4;
/** Arrow keys move the photo by this share of the visible square. */
const KEY_STEP = 0.05;

interface View {
  /** Centre of the visible square, in source pixels. */
  cx: number;
  cy: number;
  /** 1 = the largest square that fits; higher shows less. */
  zoom: number;
}

/** Keeps the square inside the image, so no empty edge can ever be cropped in. */
function clampView(view: View, width: number, height: number): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const half = Math.min(width, height) / zoom / 2;
  return {
    zoom,
    cx: Math.min(width - half, Math.max(half, view.cx)),
    cy: Math.min(height - half, Math.max(half, view.cy)),
  };
}

function cropForView(view: View, width: number, height: number): SquareCrop {
  const size = Math.min(width, height) / view.zoom;
  return { x: view.cx - size / 2, y: view.cy - size / 2, size };
}

/**
 * Lets the guest choose the square every screen shows of their photo. Without
 * it the centre was used, and a tall photo of someone in costume lost their head.
 * Drag to move, pinch, scroll or use the slider to zoom.
 */
export function PhotoCropper({
  src,
  width,
  height,
  initial,
  onConfirm,
  onCancel,
}: {
  src: string;
  /** Natural size of the image at `src`. */
  width: number;
  height: number;
  initial?: SquareCrop;
  onConfirm: (crop: SquareCrop) => void;
  onCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const [view, setView] = useState<View>(() =>
    initial
      ? clampView(
          {
            cx: initial.x + initial.size / 2,
            cy: initial.y + initial.size / 2,
            zoom: Math.min(width, height) / initial.size,
          },
          width,
          height,
        )
      : { cx: width / 2, cy: height / 2, zoom: 1 },
  );

  const update = (next: (current: View) => View) =>
    setView((current) => clampView(next(current), width, height));

  /** Source pixels per on-screen pixel right now. */
  function sourcePerPixel(): number {
    const frame = frameRef.current?.getBoundingClientRect().width || 1;
    return Math.min(width, height) / view.zoom / frame;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance.current = null;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size === 1) {
      const scale = sourcePerPixel();
      const dx = (current.x - previous.x) * scale;
      const dy = (current.y - previous.y) * scale;
      // Dragging the photo right shows more of its left side.
      update((v) => ({ ...v, cx: v.cx - dx, cy: v.cy - dy }));
      return;
    }
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (pinchDistance.current) {
      const ratio = distance / pinchDistance.current;
      update((v) => ({ ...v, zoom: v.zoom * ratio }));
    }
    pinchDistance.current = distance;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinchDistance.current = null;
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    update((v) => ({ ...v, zoom: v.zoom * Math.exp(-event.deltaY / 500) }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = (Math.min(width, height) / view.zoom) * KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update((v) => ({ ...v, cx: v.cx + move[0], cy: v.cy + move[1] }));
  }

  // Positioned in percentages of the frame, so drawing it needs no measuring.
  const crop = cropForView(view, width, height);
  const imageStyle = {
    width: `${(width / crop.size) * 100}%`,
    left: `${(-crop.x / crop.size) * 100}%`,
    top: `${(-crop.y / crop.size) * 100}%`,
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-black/10 bg-surface">
      <div
        ref={frameRef}
        role="application"
        aria-label="Photo crop. Drag or use the arrow keys to move the photo."
        tabIndex={0}
        className="relative aspect-square w-full cursor-grab touch-none overflow-hidden bg-black select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <img
          src={src}
          alt="Your entry"
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={imageStyle}
        />
        {/* Thirds, the usual framing guide. */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="border border-white/25" />
          ))}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Move className="size-4 shrink-0" aria-hidden="true" />
          Drag to position, pinch or use the slider to zoom. Everyone sees this square.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 font-semibold">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(event) => update((v) => ({ ...v, zoom: Number(event.target.value) }))}
            className="w-full accent-brand-600"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Choose another
          </Button>
          <Button size="sm" onClick={() => onConfirm(crop)}>
            <Check className="size-4" aria-hidden="true" />
            Use this photo
          </Button>
        </div>
      </div>
    </div>
  );
}

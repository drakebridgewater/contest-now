import { PHOTO_MAX_EDGE } from '@contest/shared';
import type { SquareCrop } from './PhotoCropper.tsx';

/** Loads an image and reports its natural size; rejects when the browser cannot draw it. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the photo'));
    image.src = src;
  });
}

/** Cuts the square out as a JPEG no bigger than the API would keep anyway. */
export async function cropToFile(image: HTMLImageElement, crop: SquareCrop): Promise<File> {
  const edge = Math.max(1, Math.min(PHOTO_MAX_EDGE, Math.round(crop.size)));
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, edge, edge);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Could not crop the photo');
  return new File([blob], 'entry.jpg', { type: 'image/jpeg' });
}

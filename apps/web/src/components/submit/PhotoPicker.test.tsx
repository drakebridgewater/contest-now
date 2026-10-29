import { PHOTO_MAX_BYTES } from '@contest/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoPicker } from './PhotoPicker.tsx';

const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

// jsdom never decodes an image or draws a canvas, so those two are stand-ins.
const { loadImage, cropToFile } = vi.hoisted(() => ({
  loadImage: vi.fn(),
  cropToFile: vi.fn(),
}));
vi.mock('./cropImage.ts', () => ({ loadImage, cropToFile }));

const cropped = new File([new Uint8Array(256)], 'entry.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  compress.mockReset();
  loadImage.mockReset().mockResolvedValue({ naturalWidth: 800, naturalHeight: 1200 });
  cropToFile.mockReset().mockResolvedValue(cropped);
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

function file(name: string, type: string, bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function pick(chosen: File) {
  const onChange = vi.fn();
  const { container } = render(<PhotoPicker onChange={onChange} />);
  const input = container.querySelector('input[type="file"]')!;
  await userEvent.upload(input as HTMLInputElement, chosen);
  return onChange;
}

describe('PhotoPicker', () => {
  it('offers the formats phones actually produce, HEIC included', () => {
    const { container } = render(<PhotoPicker onChange={vi.fn()} />);
    const accept = container.querySelector('input[type="file"]')!.getAttribute('accept')!;
    for (const wanted of ['image/*', 'image/heic', '.heic', '.avif']) {
      expect(accept).toContain(wanted);
    }
  });

  it('has the guest place the square, then uploads just that square', async () => {
    compress.mockResolvedValue(
      new File([new Uint8Array(512)], 'small.jpg', { type: 'image/jpeg' }),
    );
    const onChange = await pick(file('IMG_0001.JPG', 'image/jpeg'));
    const frame = await screen.findByRole('application', { name: /Photo crop/ });
    // Nothing is ready to submit until the crop is confirmed.
    expect(onChange).not.toHaveBeenCalledWith(expect.any(File));

    // A tall photo starts centred; moving up brings the top (the head) in.
    frame.focus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await userEvent.click(screen.getByRole('button', { name: /Use this photo/ }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(cropped));
    const crop = cropToFile.mock.calls[0]![1];
    expect(crop.size).toBe(800);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(200 - 2 * 800 * 0.05);
  });

  it('never lets the square leave the photo', async () => {
    compress.mockResolvedValue(
      new File([new Uint8Array(512)], 'small.jpg', { type: 'image/jpeg' }),
    );
    await pick(file('IMG_0001.JPG', 'image/jpeg'));
    const frame = await screen.findByRole('application', { name: /Photo crop/ });
    frame.focus();
    await userEvent.keyboard('{ArrowUp>20/}{ArrowLeft>20/}');
    await userEvent.click(screen.getByRole('button', { name: /Use this photo/ }));
    await waitFor(() => expect(cropToFile).toHaveBeenCalled());
    expect(cropToFile.mock.calls[0]![1]).toEqual({ x: 0, y: 0, size: 800 });
  });

  it('can reopen the crop after choosing it', async () => {
    compress.mockResolvedValue(
      new File([new Uint8Array(512)], 'small.jpg', { type: 'image/jpeg' }),
    );
    await pick(file('IMG_0001.JPG', 'image/jpeg'));
    await userEvent.click(await screen.findByRole('button', { name: /Use this photo/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Adjust/ }));
    expect(screen.getByRole('application', { name: /Photo crop/ })).toBeInTheDocument();
  });

  it('uploads the shrunken photo whole when the browser cannot draw it', async () => {
    const shrunk = new File([new Uint8Array(512)], 'small.jpg', { type: 'image/jpeg' });
    compress.mockResolvedValue(shrunk);
    loadImage.mockRejectedValue(new Error('no'));
    const onChange = await pick(file('IMG_0001.JPG', 'image/jpeg'));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.any(File)));
    expect((onChange.mock.lastCall![0] as File).size).toBe(512);
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  // The path an iPhone HEIC takes in a browser that cannot draw it: shrinking is
  // a canvas operation and throws, and the untouched file has to go up anyway so
  // the API can convert it.
  it('uploads the original when the browser cannot decode it', async () => {
    compress.mockRejectedValue(new Error('unsupported'));
    const heic = file('IMG_0002.HEIC', '');
    const onChange = await pick(heic);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(heic));
    expect(screen.queryByText(/could not/i)).not.toBeInTheDocument();
  });

  it('only refuses an undecodable file when it is also too big to send', async () => {
    compress.mockRejectedValue(new Error('unsupported'));
    const onChange = await pick(file('huge.heic', '', PHOTO_MAX_BYTES + 1));
    await waitFor(() => expect(screen.getByText(/too large/i)).toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

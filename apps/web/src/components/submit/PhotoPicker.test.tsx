import { PHOTO_MAX_BYTES } from '@contest/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoPicker } from './PhotoPicker.tsx';

const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

beforeEach(() => {
  compress.mockReset();
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

  it('uploads the shrunken file when the browser can decode it', async () => {
    compress.mockResolvedValue(
      new File([new Uint8Array(512)], 'small.jpg', { type: 'image/jpeg' }),
    );
    const onChange = await pick(file('IMG_0001.JPG', 'image/jpeg'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect((onChange.mock.calls[0]![0] as File).type).toBe('image/jpeg');
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

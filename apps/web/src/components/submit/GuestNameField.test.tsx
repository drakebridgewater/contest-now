import type { GuestName } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GuestNameField } from './GuestNameField.tsx';

const guests: GuestName[] = [
  { id: 'a', name: 'Sam Lee' },
  { id: 'b', name: 'Lisa Sanchez' },
  { id: 'c', name: 'Bo' },
];

function Harness({ onChange }: { onChange: (name: string, guest: GuestName | undefined) => void }) {
  const [value, setValue] = useState('');
  return (
    <GuestNameField
      guests={guests}
      value={value}
      onChange={(name, guest) => {
        setValue(name);
        onChange(name, guest);
      }}
    />
  );
}

describe('GuestNameField', () => {
  it('suggests guests by any part of their name and links the one picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByRole('combobox', { name: 'Your name' }), 'sa');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Sam Lee', 'Lisa Sanchez']);
    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('option', { name: 'Lisa Sanchez' }),
    });
    expect(onChange).toHaveBeenLastCalledWith('Lisa Sanchez', guests[1]);
    expect(screen.getByText(/Filed under Lisa Sanchez/)).toBeInTheDocument();
  });

  it('links a name typed out in full, whatever the case', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByRole('combobox'), 'sam  lee');
    expect(onChange).toHaveBeenLastCalledWith('sam  lee', guests[0]);
  });

  it('leaves a new name unlinked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByRole('combobox'), 'Zed');
    expect(onChange).toHaveBeenLastCalledWith('Zed', undefined);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});

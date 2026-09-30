import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DetailsPage } from './DetailsPage.tsx';
import { FaqPage } from './FaqPage.tsx';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/details" element={<DetailsPage />} />
        <Route path="/faq" element={<FaqPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('info pages', () => {
  it('shows the event details and known allergies', () => {
    renderAt('/details');
    expect(screen.getByText('Matt & Mar’s Home')).toBeInTheDocument();
    expect(screen.getByText('Fin fish (shellfish okay)')).toBeInTheDocument();
    expect(screen.getByText('Cocktail Challenge')).toBeInTheDocument();
  });

  it('switches to the FAQ and reveals an answer', async () => {
    const user = userEvent.setup();
    renderAt('/details');
    await user.click(screen.getByRole('link', { name: 'FAQ' }));
    await user.click(screen.getByText('When are the winners announced?'));
    expect(screen.getByText('Around 8–9 pm.')).toBeVisible();
  });
});

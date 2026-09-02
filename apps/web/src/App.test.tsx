import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App scaffold', () => {
  it('renders', () => {
    render(<App />);
    expect(screen.getByText(/Contest app scaffold/)).toBeInTheDocument();
  });
});

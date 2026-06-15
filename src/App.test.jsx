import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.jsx';

afterEach(() => {
  cleanup();
});

describe('Hall Of Apes landing page', () => {
  it('presents the Hall Of Apes identity and BLG evolution story', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /Hall Of Apes/i })).toBeInTheDocument();
    expect(screen.getByText(/Dari BLG ke HoA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Blasteran Gorilla Babi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JOSGC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Join Kawanan/i })[0]).toHaveAttribute('href', 'https://discord.gg/hallofapes');
  });

  it('links players to the Hall Of Apes Discord', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /Join Discord/i })).toHaveAttribute(
      'href',
      'https://discord.gg/hallofapes',
    );
    expect(screen.getByRole('link', { name: /Join Kawanan/i })).toHaveAttribute(
      'href',
      'https://discord.gg/hallofapes',
    );
  });

  it('uses the interactive origin timeline presentation', () => {
    render(<App />);

    expect(screen.getByLabelText(/HoA origin timeline/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Chapter timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Origin Trail/i })).toBeInTheDocument();
    expect(screen.getByText(/BLG -> HoA/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vertical cave timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Writings on the wall/i)).toBeInTheDocument();

    fireEvent.mouseMove(screen.getByLabelText(/HoA origin timeline/i), { clientX: 120, clientY: 240 });
    expect(screen.getByTestId('cursor-mark')).toHaveTextContent('HoA');
  });
});

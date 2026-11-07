import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const DISCORD = 'https://discord.gg/E7xcUNAGFD';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Hall Of Apes origin wall', () => {
  it('presents the identity and the BLG to HoA story', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /Hall Of Apes/i })).toBeInTheDocument();
    expect(screen.getByText(/Dari BLG ke HoA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Blasteran Gorilla Babi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JOSGC/i).length).toBeGreaterThan(0);
  });

  it('links players to the Hall Of Apes Discord from every call to action', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /Join Discord/i })).toHaveAttribute('href', DISCORD);
    expect(screen.getByRole('link', { name: /Join Kawanan/i })).toHaveAttribute('href', DISCORD);
  });

  it('keeps the wall landmark and chapter rail navigable', () => {
    render(<App />);

    expect(screen.getByRole('main', { name: /Hall Of Apes origin wall/i })).toBeInTheDocument();

    const rail = screen.getByRole('navigation', { name: /Chapter timeline/i });
    expect(rail).toBeInTheDocument();
    ['HOME', '2024', 'BLG', 'JOSGC', 'Beyond', 'HoA'].forEach((label) => {
      expect(within(rail).getByRole('link', { name: new RegExp(label, 'i') })).toHaveAttribute(
        'href',
        expect.stringMatching(/^#/),
      );
    });
  });

  it('shows every origin chapter with its carved mark', () => {
    render(<App />);

    const trail = screen.getByRole('region', { name: /Origin trail timeline/i });
    ['BLG Dibentuk', 'Gorilla, Babi, Segitiga', 'Kawanan Tumbuh', 'Lintas Genre', 'Nama Baru, Api Sama'].forEach(
      (title) => {
        expect(within(trail).getByRole('heading', { level: 2, name: new RegExp(title, 'i') })).toBeInTheDocument();
      },
    );

    // Old symbols survive as content, not emoji markup.
    expect(within(trail).getByRole('heading', { name: /Ace of Spades/i })).toBeInTheDocument();
    expect(screen.getByText(/smbdy/i)).toBeInTheDocument();
  });

  it('scrolls to a chapter when the rail is used and respects reduced motion', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: /JOSGC/i }));

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' }),
    );
  });

  it('renders new content bands without leaking placeholder copy', () => {
    render(<App />);

    expect(screen.getByRole('region', { name: /Facts about the kawanan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Satu Kawanan, Banyak Medan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Empat Aturan Dinding/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Masuk Kawanan/i })).toBeInTheDocument();
    expect(screen.queryByText(/lorem|ipsum|TODO/i)).not.toBeInTheDocument();
  });

  it('does not leave content invisible when IntersectionObserver is unavailable', () => {
    // jsdom has no IntersectionObserver, so the reveal layer must opt everything in.
    delete global.IntersectionObserver;
    render(<App />);

    expect(document.querySelectorAll('.reveal:not(.is-in)').length).toBe(0);
    expect(document.querySelectorAll('.chapter:not(.is-in)').length).toBe(0);
  });
});

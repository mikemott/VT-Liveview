import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  const originalLocation = window.location;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders the fallback with dev-only error details', () => {
    const { container } = render(
      <ErrorBoundary>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Error: kaboom')).toBeInTheDocument();
    expect(container.querySelector('.error-boundary')).not.toHaveClass('dark');
    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.anything(),
    );
  });

  it('uses the dark theme when the document is dark', () => {
    document.documentElement.classList.add('dark');
    const { container } = render(
      <ErrorBoundary>
        <Boom message="x" />
      </ErrorBoundary>,
    );
    expect(container.querySelector('.error-boundary')).toHaveClass('dark');
  });

  it('reloads the page from the refresh button', () => {
    render(
      <ErrorBoundary>
        <Boom message="x" />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Refresh Page/ }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders hostile error messages as text', () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const { container } = render(
      <ErrorBoundary>
        <Boom message={payload} />
      </ErrorBoundary>,
    );
    expect(container.querySelector('pre img')).toBeNull();
    expect(screen.getByText(`Error: ${payload}`)).toBeInTheDocument();
  });
});

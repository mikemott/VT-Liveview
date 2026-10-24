import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink, shareResultMessage } from '../share';

function stubNavigator(nav: Partial<Navigator>): void {
  vi.stubGlobal('navigator', { ...nav });
}

describe('shareLink', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    await expect(shareLink('https://x/#a', 'VT')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'VT', url: 'https://x/#a' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not copy when the user cancels the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    await expect(shareLink('u', 't')).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard without share, or when share fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    await expect(shareLink('u', 't')).resolves.toBe('copied');

    const share = vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError'));
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    await expect(shareLink('u', 't')).resolves.toBe('copied');
  });

  it('reports failure when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    await expect(shareLink('u', 't')).resolves.toBe('failed');
  });
});

describe('shareResultMessage', () => {
  it('only speaks up for copy and failure', () => {
    expect(shareResultMessage('copied')).toBe('Link copied to clipboard.');
    expect(shareResultMessage('failed')).toMatch(/address bar/);
    expect(shareResultMessage('shared')).toBeNull();
    expect(shareResultMessage('cancelled')).toBeNull();
  });
});

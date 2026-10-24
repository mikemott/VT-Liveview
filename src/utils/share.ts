export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Share a link: the native share sheet where available (phones, Safari),
 * otherwise copy it to the clipboard.
 */
export async function shareLink(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      // The user closed the share sheet; don't fall through to copying
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** User-facing message for a share result, or null when nothing needs saying. */
export function shareResultMessage(result: ShareResult): string | null {
  switch (result) {
    case 'copied':
      return 'Link copied to clipboard.';
    case 'failed':
      return "Couldn't copy the link. You can copy it from the address bar.";
    default:
      return null;
  }
}

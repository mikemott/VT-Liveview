/**
 * XSS helpers for component popup tests.
 *
 * Every upstream-derived string is replaced with XSS_PAYLOAD; the recorded popup
 * markup is then parsed into an inert <template> and checked structurally (no
 * injected <img>, no on* attributes) rather than by string matching.
 */
import { expect } from 'vitest';

declare global {
  interface Window {
    __xss?: unknown;
  }
}

export const XSS_PAYLOAD = '<img src=x onerror="window.__xss=1">';

/** Parse markup without executing it (template content is inert). */
export function parseInert(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function handlerAttributes(root: ParentNode): string[] {
  return [...root.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes]
      .filter((attr) => attr.name.toLowerCase().startsWith('on'))
      .map((attr) => `${el.tagName.toLowerCase()}[${attr.name}]`),
  );
}

interface InjectionOptions {
  /** Selector for <img> elements the component legitimately renders (e.g. logos). */
  allowedImgSelector?: string;
}

/** Assert that markup (string or DOM) contains no injected element or handler. */
export function expectNoInjectedMarkup(
  content: string | ParentNode,
  { allowedImgSelector }: InjectionOptions = {},
): void {
  const root = typeof content === 'string' ? parseInert(content) : content;
  const imgs = [...root.querySelectorAll('img')].filter(
    (img) => !(allowedImgSelector && img.matches(allowedImgSelector)),
  );
  expect(imgs.map((img) => img.outerHTML)).toEqual([]);
  expect(handlerAttributes(root)).toEqual([]);
  expect(root.querySelectorAll('script')).toHaveLength(0);
  expect(window.__xss).toBeUndefined();
}

/** The payload survived as visible text, i.e. it was escaped rather than dropped. */
export function expectPayloadAsText(content: string | ParentNode): void {
  const root = typeof content === 'string' ? parseInert(content) : content;
  expect(root.textContent).toContain(XSS_PAYLOAD);
}

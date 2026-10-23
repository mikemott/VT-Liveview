import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebGLSupported } from '../webgl';

describe('isWebGLSupported', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns false when no WebGL context can be created', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isWebGLSupported()).toBe(false);
  });

  it('returns false when getContext throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isWebGLSupported()).toBe(false);
  });

  it('returns true and releases the probe context when WebGL works', () => {
    const loseContext = vi.fn();
    const fakeGl = { getExtension: vi.fn(() => ({ loseContext })) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeGl as unknown as RenderingContext,
    );
    expect(isWebGLSupported()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });
});

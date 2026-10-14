import { describe, it, expect, beforeEach } from 'vitest';
import { saveReturnTo, consumeReturnTo, isSafeReturnPath, RETURN_TO_TTL_MS } from '@/domain/returnTo';

describe('returnTo (post-login destination)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a path once', () => {
    saveReturnTo('/oauth/authorize?client_id=x&state=y', 1000);
    expect(consumeReturnTo(2000)).toBe('/oauth/authorize?client_id=x&state=y');
    expect(consumeReturnTo(2000)).toBeNull();
  });

  it('expires after RETURN_TO_TTL_MS and still clears the entry', () => {
    saveReturnTo('/oauth/authorize', 0);
    expect(consumeReturnTo(RETURN_TO_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem('btw:returnTo')).toBeNull();
  });

  it('is null when nothing was saved or the entry is corrupt', () => {
    expect(consumeReturnTo()).toBeNull();
    localStorage.setItem('btw:returnTo', '{nope');
    expect(consumeReturnTo()).toBeNull();
  });

  it('never returns an off-site target, even if storage was tampered with', () => {
    localStorage.setItem('btw:returnTo', JSON.stringify({ path: '//evil.example/x', at: Date.now() }));
    expect(consumeReturnTo()).toBeNull();
  });

  it.each([
    ['/oauth/authorize?x=1', true],
    ['/lists', true],
    ['//evil.example', false],
    ['/\\evil.example', false],
    ['https://evil.example', false],
    ['', false],
    [42, false],
  ])('isSafeReturnPath(%j) = %s', (path, ok) => {
    expect(isSafeReturnPath(path)).toBe(ok);
  });

  it('ignores unsafe paths on save', () => {
    saveReturnTo('//evil.example');
    expect(consumeReturnTo()).toBeNull();
  });
});

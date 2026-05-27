import { describe, it, expect } from 'vitest';
import { sanitizeFreeText } from '@/../netlify/functions/_lib/sanitize';

describe('sanitizeFreeText', () => {
  it('strips http and www urls', () => {
    expect(sanitizeFreeText('Visit https://evil.com now')).toBe('Visit now');
    expect(sanitizeFreeText('See www.evil.com please')).toBe('See please');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeFreeText('  hello   world  ')).toBe('hello world');
  });

  it('truncates to maxLen', () => {
    expect(sanitizeFreeText('abcdefghij', 5)).toBe('abcde');
  });
});

import { describe, it, expect } from 'vitest';
import { capitalizeInitial } from '@/domain/text';

describe('capitalizeInitial', () => {
  it('returns empty string when input is empty', () => {
    expect(capitalizeInitial('')).toBe('');
  });

  it('returns empty string when input is whitespace only', () => {
    expect(capitalizeInitial('   ')).toBe('');
  });

  it('trims and uppercases first character', () => {
    expect(capitalizeInitial('  mela  ')).toBe('Mela');
  });

  it('leaves already-capitalized string unchanged (after trim)', () => {
    expect(capitalizeInitial('Pane')).toBe('Pane');
  });

  it('handles single-character lowercase', () => {
    expect(capitalizeInitial('a')).toBe('A');
  });

  it('handles single-character already-uppercase', () => {
    expect(capitalizeInitial('A')).toBe('A');
  });

  it('handles accented initials (locale-aware)', () => {
    expect(capitalizeInitial('èclair')).toBe('Èclair');
  });

  it('preserves the rest of the string verbatim', () => {
    expect(capitalizeInitial('pane INTEGRALE bio')).toBe('Pane INTEGRALE bio');
  });

  it('does not touch non-letter initials', () => {
    expect(capitalizeInitial('123 cose')).toBe('123 cose');
  });
});

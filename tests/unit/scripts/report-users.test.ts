import { describe, it, expect } from 'vitest';
// The script guards its main() behind a direct-execution check, so importing
// here is side-effect-free (no Firebase init). We only exercise the pure
// helpers: aggregation shaping and safe HTML rendering.
import { buildUserReports, renderDashboard } from '../../../scripts/report-users.mjs';

const rawFixture = () => ({
  users: [
    { uid: 'u1', email: 'anna@x.it', displayName: 'Anna', photoURL: 'p1' },
    { uid: 'u2', email: 'bob@y.it', displayName: 'Bob', photoURL: '' },
  ],
  privateByUid: {
    u1: {
      lastLoginAt: 2000,
      onboardingSeen: true,
      defaultListId: 'L1',
      completedShopCount: 5,
      lastCompletedShopAt: 1900,
    },
    // u2 has no private/state doc at all.
  },
  notificationsCountByUid: { u1: 3 },
  catalogCountByUid: { u1: 12, u2: 1 },
  lists: [
    { id: 'L1', name: 'Casa', ownerUid: 'u1', admins: ['u1'], collaboratorUids: ['u1', 'u2'] },
    { id: 'L2', name: 'Ufficio', ownerUid: 'u2', admins: ['u2'], collaboratorUids: ['u2'] },
  ],
  historyByUid: {
    u1: [
      { completedAt: 1800, itemCount: 4, listId: 'L1', trigger: 'completion' },
      { completedAt: 1700, itemCount: 2, listId: 'L1', trigger: 'empty_fallback' },
    ],
  },
});

describe('report-users buildUserReports', () => {
  it('joins per-user data across all sources', () => {
    const reports = buildUserReports(rawFixture());
    const u1 = reports.find((r) => r.uid === 'u1')!;
    expect(u1.email).toBe('anna@x.it');
    expect(u1.completedShopCount).toBe(5);
    expect(u1.lastCompletedShopAt).toBe(1900);
    expect(u1.catalogSize).toBe(12);
    expect(u1.notifications).toBe(3);
    expect(u1.completions).toBe(1);
    expect(u1.emptyFallbacks).toBe(1);
    expect(u1.ownedLists).toEqual([{ id: 'L1', name: 'Casa' }]);
    expect(u1.sharedLists).toEqual([]);
  });
});

describe('report-users renderDashboard (XSS safety)', () => {
  it('embeds data as JSON with < escaped so a hostile displayName cannot break out of the script tag', () => {
    const raw = rawFixture();
    raw.users[0].displayName = '</script><img src=x onerror=alert(1)>';
    const html = renderDashboard(buildUserReports(raw), { projectId: 'demo', generatedAt: 0 });
    // Raw closing tag / raw markup must never appear verbatim in the output.
    expect(html).not.toContain('</script><img');
    expect(html).not.toContain('<img src=x onerror');
    // The escaped form is present instead.
    expect(html).toContain('\\u003c');
  });
});

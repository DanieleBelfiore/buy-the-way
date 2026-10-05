import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { i18n } from '@/i18n';
import SuggestSheet from '@/components/list/SuggestSheet.vue';
import type { Suggestion } from '@/domain/suggest';

const suggestion = (overrides: Partial<Suggestion> & { name: string }): Suggestion => ({
  key: overrides.name.toLowerCase(),
  category: 'other',
  quantity: '',
  purchaseCount: 3,
  intervalDays: 7,
  preselected: true,
  ...overrides,
});

const SUGGESTIONS: Suggestion[] = [
  suggestion({ name: 'Latte', category: 'dairy', quantity: '2' }),
  suggestion({ name: 'Pane', category: 'bakery', intervalDays: 1 }),
  suggestion({ name: 'Sale', preselected: false, intervalDays: null }),
];

type Props = InstanceType<typeof SuggestSheet>['$props'];

const mountSheet = (props: Partial<Props> = {}): VueWrapper =>
  mount(SuggestSheet, {
    props: {
      open: true,
      status: 'ready',
      runCount: 5,
      suggestions: SUGGESTIONS,
      ...props,
    },
    global: { plugins: [i18n] },
  });

const checkbox = (wrapper: VueWrapper, key: string) =>
  wrapper.find<HTMLInputElement>(`[data-testid="suggest-check-${key}"]`);
const submit = (wrapper: VueWrapper) => wrapper.find('[data-testid="suggest-submit"]');

describe('SuggestSheet', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'back').mockImplementation(() => {});
    history.replaceState(null, '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    const wrapper = mountSheet({ open: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('ticks preselected suggestions and leaves the others unticked', () => {
    const wrapper = mountSheet();
    expect(checkbox(wrapper, 'latte').element.checked).toBe(true);
    expect(checkbox(wrapper, 'pane').element.checked).toBe(true);
    expect(checkbox(wrapper, 'sale').element.checked).toBe(false);
    expect(submit(wrapper).text()).toContain('Add 2 items');
  });

  it('splits rows into due and other-regulars sections', () => {
    const wrapper = mountSheet();
    const due = wrapper.find('[data-testid="suggest-section-due"]');
    const others = wrapper.find('[data-testid="suggest-section-others"]');
    expect(due.findAll('[data-testid="suggest-row"]')).toHaveLength(2);
    expect(others.findAll('[data-testid="suggest-row"]')).toHaveLength(1);
  });

  it('groups each section by category, in category order, with a heading', () => {
    const wrapper = mountSheet({
      suggestions: [
        suggestion({ name: 'Bread', category: 'bakery' }),
        suggestion({ name: 'Apple', category: 'fruit_vegetables' }),
        suggestion({ name: 'Banana', category: 'fruit_vegetables' }),
        suggestion({ name: 'Soap', category: 'hygiene', preselected: false }),
      ],
    });
    const due = wrapper.find('[data-testid="suggest-section-due"]');
    const groups = due.findAll('[data-testid^="suggest-group-"]');
    expect(groups.map((g) => g.attributes('data-testid'))).toEqual([
      'suggest-group-due-fruit_vegetables',
      'suggest-group-due-bakery',
    ]);
    expect(groups[0]?.find('h4').text()).toContain('Fruit');
    expect(groups[0]?.findAll('[data-testid="suggest-row"]')).toHaveLength(2);
    expect(
      wrapper.find('[data-testid="suggest-group-others-hygiene"]').exists(),
    ).toBe(true);
  });

  it('shows the product icon when known and the category icon otherwise', () => {
    const wrapper = mountSheet({
      suggestions: [
        suggestion({ name: 'Apple', category: 'fruit_vegetables' }),
        suggestion({ name: 'Banana', category: 'fruit_vegetables' }),
        suggestion({ name: 'Mystery fruit', category: 'fruit_vegetables' }),
      ],
    });
    const icons = wrapper.findAll('[data-testid="suggest-row-icon"]').map((i) => i.text());
    expect(icons).toEqual(['\u{1F34E}', '\u{1F34C}', '\u{1F955}']);
  });

  it('shows last quantity and repurchase cadence', () => {
    const wrapper = mountSheet();
    const rows = wrapper.findAll('[data-testid="suggest-row"]').map((r) => r.text());
    expect(rows[0]).toContain('2');
    expect(rows[0]).toContain('every ~7 days');
    expect(rows[1]).toContain('every day');
    expect(rows[2]).not.toContain('every');
  });

  it('emits the ticked suggestions on submit', async () => {
    const wrapper = mountSheet();
    await checkbox(wrapper, 'pane').setValue(false);
    await checkbox(wrapper, 'sale').setValue(true);
    await submit(wrapper).trigger('click');
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Suggestion[];
    expect(payload.map((s) => s.name)).toEqual(['Latte', 'Sale']);
  });

  it('submits only once while the parent is saving', async () => {
    const wrapper = mountSheet();
    await submit(wrapper).trigger('click');
    await submit(wrapper).trigger('click');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('toggles between select all and deselect all', async () => {
    const wrapper = mountSheet();
    const toggle = wrapper.find('[data-testid="suggest-toggle-all"]');
    expect(toggle.text()).toBe('Select all');
    await toggle.trigger('click');
    expect(checkbox(wrapper, 'sale').element.checked).toBe(true);
    expect(toggle.text()).toBe('Deselect all');
    await toggle.trigger('click');
    expect(checkbox(wrapper, 'latte').element.checked).toBe(false);
    expect(submit(wrapper).attributes('disabled')).toBeDefined();
  });

  it('resets the selection when reopened', async () => {
    const wrapper = mountSheet();
    await checkbox(wrapper, 'latte').setValue(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    expect(checkbox(wrapper, 'latte').element.checked).toBe(true);
  });

  it('shows a loading message and no submit while loading', () => {
    const wrapper = mountSheet({ status: 'loading', suggestions: [], runCount: 0 });
    expect(wrapper.find('[data-testid="suggest-message"]').text()).toContain('Reading');
    expect(submit(wrapper).exists()).toBe(false);
  });

  it('shows an error message', () => {
    const wrapper = mountSheet({ status: 'error', suggestions: [], runCount: 0 });
    expect(wrapper.find('[data-testid="suggest-message"]').text()).toContain('Could not read');
  });

  it('explains when the history is too short', () => {
    const wrapper = mountSheet({ suggestions: [], runCount: 1 });
    expect(wrapper.find('[data-testid="suggest-message"]').text()).toContain('At least 2');
  });

  it('explains when there is nothing to suggest', () => {
    const wrapper = mountSheet({ suggestions: [], runCount: 6 });
    expect(wrapper.find('[data-testid="suggest-message"]').text()).toContain('Nothing to suggest');
  });

  it('emits cancel from the backdrop, the cancel button and Escape', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="suggest-backdrop"]').trigger('click');
    await wrapper.find('[data-testid="suggest-cancel"]').trigger('click');
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('cancel')).toHaveLength(3);
  });
});

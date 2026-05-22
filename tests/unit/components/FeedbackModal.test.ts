import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import FeedbackModal from '@/components/ui/FeedbackModal.vue';
import { useAuthStore } from '@/stores/auth';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      settings: {
        feedbackTitle: 'Send feedback',
        feedbackHint: 'Tell me anything.',
        feedbackPlaceholder: 'Type here…',
        feedbackSubmit: 'Send',
        feedbackCancel: 'Cancel',
        feedbackSending: 'Sending…',
        feedbackError: 'Send failed.',
      },
    },
  },
});

const mountModal = (open = true) =>
  mount(FeedbackModal, { props: { open }, global: { plugins: [i18n] } });

describe('FeedbackModal', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'uid-1', email: 'me@x.com', displayName: 'Me' },
    } as any);
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render when open=false', () => {
    const wrapper = mountModal(false);
    expect(wrapper.find('[data-testid="feedback-textarea"]').exists()).toBe(false);
  });

  it('renders textarea and buttons when open=true', () => {
    const wrapper = mountModal();
    expect(wrapper.find('[data-testid="feedback-textarea"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="feedback-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="feedback-cancel"]').exists()).toBe(true);
  });

  it('submit button disabled when textarea is empty/whitespace', async () => {
    const wrapper = mountModal();
    expect(wrapper.get('[data-testid="feedback-submit"]').attributes('disabled')).toBeDefined();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('   ');
    expect(wrapper.get('[data-testid="feedback-submit"]').attributes('disabled')).toBeDefined();
  });

  it('clicking cancel emits close', async () => {
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-cancel"]').trigger('click');
    expect(wrapper.emitted('close')?.length).toBe(1);
  });

  it('Escape key emits close', async () => {
    const wrapper = mountModal();
    await wrapper.find('[role="dialog"]').trigger('keydown.esc');
    expect(wrapper.emitted('close')?.length).toBe(1);
  });

  it('backdrop click emits close', async () => {
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-modal-backdrop"]').trigger('click');
    expect(wrapper.emitted('close')?.length).toBe(1);
  });

  it('submit POSTs to "/" with form-urlencoded body containing form-name=feedback', async () => {
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('Hello there');
    await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = opts.body as string;
    expect(body).toContain('form-name=feedback');
    expect(body).toContain('message=Hello%20there');
    expect(body).toContain('uid=uid-1');
    expect(body).toContain('email=me%40x.com');
    expect(body).toContain('bot-field=');
  });

  it('emits submitted + close on successful POST', async () => {
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('hi');
    await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('submitted')?.length).toBe(1);
    expect(wrapper.emitted('close')?.length).toBe(1);
  });

  it('shows an error and does not emit submitted/close when POST fails', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('hi');
    await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="feedback-error"]').exists()).toBe(true);
    expect(wrapper.emitted('submitted')).toBeUndefined();
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('does not submit when message is whitespace only', async () => {
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('     ');
    await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows error UI on network exception', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const wrapper = mountModal();
    await wrapper.find('[data-testid="feedback-textarea"]').setValue('hi');
    await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="feedback-error"]').exists()).toBe(true);
  });
});

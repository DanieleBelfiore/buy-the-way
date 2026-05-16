import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import AddCollaboratorForm from '@/components/collaborators/AddCollaboratorForm.vue';
import { UserNotFoundError } from '@/services/lists.service';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      collaborators: {
        add: 'Add collaborator',
        addPlaceholder: 'Email address…',
        submit: 'Add',
        notFound: 'No registered user with that email.',
        added: 'Collaborator added.',
      },
    },
  },
});

const mountForm = (submitFn: (email: string) => Promise<unknown>) =>
  mount(AddCollaboratorForm, {
    props: { submitFn: submitFn as never },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('AddCollaboratorForm', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('renders email input and submit button', () => {
    const wrapper = mountForm(vi.fn());
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('disables submit when input empty', async () => {
    const wrapper = mountForm(vi.fn());
    const btn = wrapper.get('button[type="submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
    await wrapper.find('input').setValue('a@b.com');
    expect(btn.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('calls submitFn with email on submit', async () => {
    const submitFn = vi.fn().mockResolvedValue({
      uid: 'uid-2',
      email: 'a@b.com',
      displayName: 'A',
      lastLoginAt: 0,
    });
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('a@b.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(submitFn).toHaveBeenCalledWith('a@b.com');
    wrapper.unmount();
  });

  it('emits added with profile on success and clears input', async () => {
    const profile = { uid: 'uid-2', email: 'a@b.com', displayName: 'A', lastLoginAt: 0 };
    const submitFn = vi.fn().mockResolvedValue(profile);
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('a@b.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(wrapper.emitted('added')).toBeTruthy();
    expect(wrapper.emitted('added')![0][0]).toEqual(profile);
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    wrapper.unmount();
  });

  it('shows not-found inline error when service throws UserNotFoundError', async () => {
    const submitFn = vi.fn().mockRejectedValue(new UserNotFoundError('nobody@x.com'));
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('nobody@x.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(wrapper.text()).toContain('No registered user with that email.');
    expect(wrapper.emitted('added')).toBeFalsy();
    wrapper.unmount();
  });

  it('clears not-found error when user edits input again', async () => {
    const submitFn = vi.fn().mockRejectedValue(new UserNotFoundError('nobody@x.com'));
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('nobody@x.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(wrapper.text()).toContain('No registered user');
    await wrapper.find('input').setValue('nobody@x.co');
    expect(wrapper.text()).not.toContain('No registered user');
    wrapper.unmount();
  });

  it('disables submit while pending', async () => {
    let resolve!: (v: unknown) => void;
    const submitFn = vi.fn(
      () => new Promise((r) => (resolve = r)),
    );
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('a@b.com');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    resolve({ uid: 'u', email: 'a@b.com', displayName: '', lastLoginAt: 0 });
    await flushPromises();
    wrapper.unmount();
  });

  it('does not submit on empty input via Enter', async () => {
    const submitFn = vi.fn();
    const wrapper = mountForm(submitFn);
    await wrapper.find('form').trigger('submit.prevent');
    expect(submitFn).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shows generic error on non-UserNotFoundError', async () => {
    const submitFn = vi.fn().mockRejectedValue(new Error('boom'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountForm(submitFn);
    await wrapper.find('input').setValue('a@b.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(wrapper.text()).toContain('boom');
    consoleErr.mockRestore();
    wrapper.unmount();
  });
});

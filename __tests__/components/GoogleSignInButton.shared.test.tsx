/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { webcrypto } from 'crypto';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { GoogleIdConfiguration, GoogleButtonOptions } from '@/types/google-identity';

// This test uses the real Google helper module. Only the Google script is faked.
// The helper keeps page-wide state, so this file holds a single test with a fresh module.
const initialize = jest.fn<void, [GoogleIdConfiguration]>();
const renderButton = jest.fn<void, [HTMLElement, GoogleButtonOptions]>();

function props() {
  return { onStart: jest.fn(), onCredential: jest.fn(), onUnavailable: jest.fn() };
}

it('sets Google up once for two panels and sends each token to the newest one', async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  window.google = { accounts: { id: { initialize, renderButton } } };

  const first = props();
  const second = props();
  render(<GoogleSignInButton {...first} />);
  const secondRender = render(<GoogleSignInButton {...second} />);
  await waitFor(() => expect(document.head.querySelector('script')).not.toBeNull());
  document.head.querySelector('script')!.dispatchEvent(new Event('load'));
  await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(2));

  expect(initialize).toHaveBeenCalledTimes(1);
  expect(document.head.querySelectorAll('script')).toHaveLength(1);

  const callback = initialize.mock.calls[0][0].callback;
  callback({ credential: 'token-1' });
  expect(second.onCredential).toHaveBeenCalledWith('token-1', expect.stringMatching(/^[0-9a-f]{64}$/));
  expect(first.onCredential).not.toHaveBeenCalled();

  secondRender.unmount();
  callback({ credential: 'token-2' });
  expect(first.onCredential).toHaveBeenCalledWith('token-2', second.onCredential.mock.calls[0][1]);
});

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { GoogleIdConfiguration, GoogleButtonOptions } from '@/types/google-identity';

const mockEnsure = jest.fn();
const mockRegister = jest.fn();
jest.mock('@/lib/auth/google-identity', () => ({
  ensureGoogleInitialized: () => mockEnsure(),
  registerGoogleCredentialHandler: (handler: unknown) => mockRegister(handler),
  isInAppBrowser: (ua: string) => /\bLine\//.test(ua),
}));

const initialize = jest.fn<void, [GoogleIdConfiguration]>();
const renderButton = jest.fn<void, [HTMLElement, GoogleButtonOptions]>();

function renderIt() {
  const props = { onStart: jest.fn(), onCredential: jest.fn(), onUnavailable: jest.fn() };
  render(<GoogleSignInButton {...props} />);
  return props;
}

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.google = { accounts: { id: { initialize, renderButton } } };
    // Setup resolves to Google's API object, like the real ensureGoogleInitialized.
    mockEnsure.mockImplementation(() => Promise.resolve(window.google!.accounts.id));
    mockRegister.mockReturnValue(jest.fn());
  });

  it('waits for the shared Google setup, then renders the button', async () => {
    renderIt();
    await waitFor(() => expect(renderButton).toHaveBeenCalled());

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(initialize).not.toHaveBeenCalled();
    const [element, options] = renderButton.mock.calls[0];
    expect(element).toBe(screen.getByTestId('google-signin-button'));
    expect(options).toEqual(
      expect.objectContaining({ type: 'standard', text: 'signin_with', locale: 'zh_TW', logo_alignment: 'center' })
    );
  });

  it('reports the click through onStart', async () => {
    const props = renderIt();
    await waitFor(() => expect(renderButton).toHaveBeenCalled());

    renderButton.mock.calls[0][1].click_listener!();

    expect(props.onStart).toHaveBeenCalledTimes(1);
  });

  it('registers a handler that passes the ID token and raw nonce to the latest onCredential', async () => {
    const props = renderIt();
    expect(mockRegister).toHaveBeenCalledTimes(1);

    mockRegister.mock.calls[0][0]('id-token', 'raw-nonce');

    expect(props.onCredential).toHaveBeenCalledWith('id-token', 'raw-nonce');
  });

  it('unregisters its handler on unmount', () => {
    const unregister = jest.fn();
    mockRegister.mockReturnValue(unregister);
    const { unmount } = render(
      <GoogleSignInButton onStart={jest.fn()} onCredential={jest.fn()} onUnavailable={jest.fn()} />
    );

    unmount();

    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('calls onUnavailable and renders nothing when the script fails to load', async () => {
    mockEnsure.mockRejectedValue(new Error('blocked'));
    const props = renderIt();

    await waitFor(() => expect(props.onUnavailable).toHaveBeenCalledTimes(1));
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('does not render after unmount', async () => {
    let finishLoad: () => void = () => {};
    mockEnsure.mockReturnValue(new Promise((resolve) => { finishLoad = () => resolve(window.google!.accounts.id); }));
    const { unmount } = render(
      <GoogleSignInButton onStart={jest.fn()} onCredential={jest.fn()} onUnavailable={jest.fn()} />
    );

    unmount();
    finishLoad();
    await Promise.resolve();
    await Promise.resolve();

    expect(renderButton).not.toHaveBeenCalled();
  });

  describe('in-app browsers', () => {
    const originalUserAgent = navigator.userAgent;
    afterEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
    });

    it('calls onUnavailable and never loads Google in an in-app browser', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.8.0',
        configurable: true,
      });
      const props = renderIt();

      await waitFor(() => expect(props.onUnavailable).toHaveBeenCalledTimes(1));
      expect(mockEnsure).not.toHaveBeenCalled();
      expect(mockRegister).not.toHaveBeenCalled();
      expect(renderButton).not.toHaveBeenCalled();
    });
  });
});

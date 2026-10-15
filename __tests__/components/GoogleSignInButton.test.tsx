/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { GoogleIdConfiguration, GoogleButtonOptions } from '@/types/google-identity';

const mockLoad = jest.fn();
const mockCreateNonce = jest.fn();
jest.mock('@/lib/auth/google-identity', () => ({
  GOOGLE_CLIENT_ID: 'client-123',
  loadGoogleIdentity: () => mockLoad(),
  createNonce: () => mockCreateNonce(),
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
    mockLoad.mockResolvedValue(undefined);
    mockCreateNonce.mockResolvedValue({ raw: 'raw-nonce', hashed: 'hashed-nonce' });
  });

  it('initializes Google with the client id and the hashed nonce, then renders the button', async () => {
    renderIt();
    await waitFor(() => expect(renderButton).toHaveBeenCalled());

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-123', nonce: 'hashed-nonce' })
    );
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

  it('passes the ID token and the raw nonce to onCredential', async () => {
    const props = renderIt();
    await waitFor(() => expect(initialize).toHaveBeenCalled());

    initialize.mock.calls[0][0].callback({ credential: 'id-token' });

    expect(props.onCredential).toHaveBeenCalledWith('id-token', 'raw-nonce');
  });

  it('calls onUnavailable and renders nothing when the script fails to load', async () => {
    mockLoad.mockRejectedValue(new Error('blocked'));
    const props = renderIt();

    await waitFor(() => expect(props.onUnavailable).toHaveBeenCalledTimes(1));
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('does not render after unmount', async () => {
    let finishLoad: () => void = () => {};
    mockLoad.mockReturnValue(new Promise<void>((resolve) => { finishLoad = resolve; }));
    const { unmount } = render(
      <GoogleSignInButton onStart={jest.fn()} onCredential={jest.fn()} onUnavailable={jest.fn()} />
    );

    unmount();
    finishLoad();
    await Promise.resolve();
    await Promise.resolve();

    expect(renderButton).not.toHaveBeenCalled();
  });

  it('calls onUnavailable once and renders nothing when the nonce cannot be made', async () => {
    mockCreateNonce.mockRejectedValue(new Error('crypto.subtle is undefined'));
    const props = renderIt();

    await waitFor(() => expect(props.onUnavailable).toHaveBeenCalledTimes(1));
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('calls onUnavailable once when the script loads but window.google is missing', async () => {
    window.google = undefined;
    const props = renderIt();

    await waitFor(() => expect(props.onUnavailable).toHaveBeenCalledTimes(1));
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
      expect(mockLoad).not.toHaveBeenCalled();
      expect(renderButton).not.toHaveBeenCalled();
    });
  });
});

/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost/checkout"}
 */
import React from 'react';
import { render } from '@testing-library/react';
import LoginSuccessTracker from '@/components/LoginSuccessTracker';
import { readCookie } from '@/lib/auth/browser-cookies';

describe('LoginSuccessTracker', () => {
  beforeEach(() => {
    window.dataLayer = [];
    document.cookie = 'login_just_succeeded=; Max-Age=0; Path=/';
  });

  it('reports login_succeeded from the cookie and clears it', () => {
    document.cookie = 'login_just_succeeded=google; Path=/';

    render(<LoginSuccessTracker />);

    expect(window.dataLayer).toEqual([
      { event: 'login_succeeded', method: 'google', source_path: '/checkout' },
    ]);
    expect(readCookie('login_just_succeeded')).toBeNull();
  });

  it('reports magic_link too', () => {
    document.cookie = 'login_just_succeeded=magic_link; Path=/';
    render(<LoginSuccessTracker />);
    expect(window.dataLayer[0]).toMatchObject({ method: 'magic_link' });
  });

  it('does nothing without the cookie', () => {
    render(<LoginSuccessTracker />);
    expect(window.dataLayer).toHaveLength(0);
  });

  it('clears but does not report an unknown method value', () => {
    document.cookie = 'login_just_succeeded=facebook; Path=/';

    render(<LoginSuccessTracker />);

    expect(window.dataLayer).toHaveLength(0);
    expect(readCookie('login_just_succeeded')).toBeNull();
  });

  it('reports only once when mounted twice', () => {
    document.cookie = 'login_just_succeeded=google; Path=/';
    const first = render(<LoginSuccessTracker />);
    first.unmount();
    render(<LoginSuccessTracker />);
    expect(window.dataLayer).toHaveLength(1);
  });

  it('renders nothing', () => {
    const { container } = render(<LoginSuccessTracker />);
    expect(container).toBeEmptyDOMElement();
  });
});

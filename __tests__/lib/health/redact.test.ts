/**
 * @jest-environment node
 */
import { redactSecrets, errorText, SECRET_ENV_NAMES as NAMES } from '@/lib/health/redact';

describe('redactSecrets', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => NAMES.forEach((n) => { saved[n] = process.env[n]; delete process.env[n]; }));
  afterEach(() => NAMES.forEach((n) => { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n]; }));

  it('lists the five secrets the health page must hide', () => {
    expect([...NAMES].sort()).toEqual(
      ['BLOB_READ_WRITE_TOKEN', 'ECPAY_HASH_IV', 'ECPAY_HASH_KEY', 'HEALTH_CHECK_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    );
  });

  it('replaces every configured secret value with ***', () => {
    NAMES.forEach((n) => { process.env[n] = `value-of-${n}`; });
    const text = NAMES.map((n) => `x ${`value-of-${n}`} y`).join(' | ');
    const result = redactSecrets(text);
    expect(result).not.toContain('value-of-');
    expect(result.match(/\*\*\*/g)).toHaveLength(NAMES.length);
  });

  it('leaves text unchanged when a variable is unset or empty', () => {
    process.env.HEALTH_CHECK_KEY = '';
    expect(redactSecrets('plain text')).toBe('plain text');
  });

  it('errorText redacts the message of an Error and stringifies other values', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok-123';
    expect(errorText(new Error('bad tok-123'))).toBe('bad ***');
    expect(errorText('oops')).toBe('oops');
  });
});

// The environment variables whose values must never reach a log or a response.
export const SECRET_ENV_NAMES = [
  'HEALTH_CHECK_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'ECPAY_HASH_KEY',
  'ECPAY_HASH_IV',
];

// Replaces the value of every configured secret with ***.
// Empty or unset values are skipped. Call it on any text that may reach a log or a response.
export function redactSecrets(text: string): string {
  let result = text;
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    if (value) result = result.split(value).join('***');
  }
  return result;
}

// Returns the message of an error with secrets removed.
// A thrown value that is not an Error is turned into text first.
export function errorText(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

/**
 * Full-page navigation. Kept in its own module so tests can mock it.
 * jsdom does not implement window.location.assign and does not let
 * tests replace window.location.
 */
export function assignLocation(url: string): void {
  window.location.assign(url);
}

import MarkdownIt from 'markdown-it';

/**
 * Turns article Markdown into HTML that is safe to put on the page.
 *
 * Raw HTML in the Markdown is escaped, so `<script>` shows up as text.
 * Links and images with unsafe schemes such as `javascript:` are not rendered.
 * The article files are written by hand, but a mistake must not run code.
 */
const md = new MarkdownIt({
  // Escape every raw HTML tag instead of passing it through.
  html: false,
  // Only explicit Markdown links become links. Bare URLs stay plain text.
  linkify: false,
  typographer: false,
});

/**
 * Renders Markdown to safe HTML.
 *
 * @param source - The Markdown body, without front matter.
 * @returns HTML with raw tags escaped and unsafe links dropped.
 */
export function renderMarkdown(source: string): string {
  return md.render(source);
}

/**
 * Points the browser chrome's `theme-color` at the active theme's header color.
 * index.html ships a fixed fallback, kept when the browser cannot parse the theme's value.
 */
export function applyThemeColor(doc: Document = document) {
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const color = getComputedStyle(doc.documentElement).getPropertyValue('--color-brand-700').trim();
  if (meta && color && CSS.supports('color', color)) meta.content = color;
}

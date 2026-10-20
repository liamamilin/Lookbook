// Deployment and product settings for Lookbook. Everything optional is off by default.
export default {
  // Public origin (no path, no trailing slash), e.g. 'https://lookbook.example.com'.
  // Needed for absolute og:image URLs and sitemap.xml; both are skipped when empty.
  siteUrl: 'https://liamamilin.github.io',

  // Path the site is served from. '/' for a root domain, '/<repo>/' for a GitHub Pages
  // project site. The LOOKBOOK_BASE env var overrides it.
  base: '/Lookbook/',

  // Where the "反馈 / Feedback" link points (e.g. a GitHub issues URL). Hidden when empty.
  feedbackUrl: 'https://github.com/liamamilin/Lookbook/issues',

  // Analytics script injected into every page. Hidden when `src` is empty.
  // Plausible: { src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': 'example.com' } }
  // Umami:     { src: 'https://cloud.umami.is/script.js', attrs: { 'data-website-id': '…' } }
  analytics: { src: '', attrs: {} },
}

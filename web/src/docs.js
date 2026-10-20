// Renders a DESIGN.md body for the docs tab. The files come from community pull requests
// upstream, so the HTML is sanitised. Both libraries are loaded on demand.
export async function renderDocs(markdown) {
  const [{ marked }, { default: DOMPurify }] = await Promise.all([import('marked'), import('dompurify')])
  return DOMPurify.sanitize(marked.parse(markdown))
}

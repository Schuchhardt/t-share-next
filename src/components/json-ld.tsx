/**
 * A structured-data block, the way Next.js recommends shipping one: a plain
 * `<script>` in the page rather than anything in `<head>`.
 *
 * `JSON.stringify` does not escape `<`, and every string in these graphs is
 * teacher-supplied (a title, an objective, a name), so the `<` is replaced
 * with its unicode escape before the payload reaches the document — otherwise
 * a title containing `</script>` would end the block and inject markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

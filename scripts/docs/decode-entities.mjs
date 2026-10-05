const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" }

/**
 * Text with the entities that code samples and links use turned back into
 * characters. One pass, so `&amp;lt;` becomes `&lt;` and no more.
 */
export function decodeEntities(text) {
  return text.replace(/&(?:lt|gt|amp|quot|#39);/g, (entity) => ENTITIES[entity])
}

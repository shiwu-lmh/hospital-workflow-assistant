// Adapted from VelvetAbyss/browser-agent-recorder src/shared/selector.ts.
// Upstream commit: 9e632a32acdd749d8e95ef3d1e701de7fa609183 (MIT).
// Changes: standalone content-script API, safe attribute escaping, fail-closed uniqueness.
(() => {
  const unstable = /(^|[-_])([0-9a-f]{5,}|css-[a-z0-9]+|sc-[a-z0-9]+|jsx-[0-9]+|emotion-[0-9]+)($|[-_])/i;
  const attr = (key, value) => `[${key}="${CSS.escape(value)}"]`;
  function unique(doc, selector, target) {
    try { const nodes = doc.querySelectorAll(selector); return nodes.length === 1 && nodes[0] === target; } catch { return false; }
  }
  function candidates(node) {
    const tag = node.localName, out = [];
    for (const key of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
      const value = node.getAttribute(key); if (value) out.push(attr(key, value), tag + attr(key, value));
    }
    for (const key of ['name', 'aria-label', 'role', 'type']) {
      const value = node.getAttribute(key); if (value) out.push(tag + attr(key, value));
    }
    const classes = [...node.classList].filter(c => c.length < 40 && !unstable.test(c));
    if (classes.length) out.push(`${tag}.${classes.map(CSS.escape).join('.')}`);
    const siblings = node.parentElement ? [...node.parentElement.children].filter(c => c.localName === tag) : [node];
    out.push(`${tag}:nth-of-type(${siblings.indexOf(node) + 1})`, tag);
    return out;
  }
  globalThis.HospitalSelector = node => {
    const doc = node.ownerDocument;
    if (node.id && unique(doc, `#${CSS.escape(node.id)}`, node)) return `#${CSS.escape(node.id)}`;
    for (const candidate of candidates(node)) if (unique(doc, candidate, node)) return candidate;
    const chain = [];
    for (let current = node, depth = 0; current && depth < 20; current = current.parentElement, depth++) {
      const local = candidates(current);
      for (const candidate of local) { const path = [candidate, ...chain].join(' > '); if (unique(doc, path, node)) return path; }
      chain.unshift(local.at(-2));
    }
    throw new Error('无法定位唯一元素，请人工指定选择器');
  };
})();

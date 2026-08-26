(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HyloStructure = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function detail(node) {
    const id = node.attrs?.id?.trim();
    if (id) return "#" + id;
    const firstClass = node.attrs?.class?.trim().split(/\s+/)[0];
    return firstClass ? "." + firstClass : "";
  }
  function buildDocumentOutline(rootNode) {
    function visit(node) {
      const children = (node.children || []).flatMap(visit);
      if (node.type !== "element" || !node.tagName || !node.sourceLocation) return children;
      return [{ nodeId: node.nodeId, tagName: node.tagName, detail: detail(node), children }];
    }
    return visit(rootNode);
  }
  function countOutlineItems(items) {
    return items.reduce((count, item) => count + 1 + countOutlineItems(item.children), 0);
  }
  function findNodeTrail(rootNode, nodeId) {
    function visit(node, trail) {
      const next = node.type === "element" && node.tagName
        ? [...trail, { nodeId: node.nodeId, tagName: node.tagName, detail: detail(node) }]
        : trail;
      if (node.nodeId === nodeId) return next;
      for (const child of node.children || []) {
        const found = visit(child, next);
        if (found) return found;
      }
      return null;
    }
    return visit(rootNode, []) || [];
  }
  return { buildDocumentOutline, countOutlineItems, findNodeTrail };
});

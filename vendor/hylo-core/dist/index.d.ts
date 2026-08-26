export interface SourceLocation {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  startOffset: number;
  endOffset: number;
}

export interface HyloNode {
  nodeId: string;
  type: "element" | "text" | "comment" | "document" | "doctype";
  tagName?: string;
  attrs?: Record<string, string>;
  children?: HyloNode[];
  textContent?: string;
  sourceLocation: SourceLocation | null;
}

export interface ParseResult {
  root: HyloNode;
  nodeMap: Map<string, SourceLocation>;
  parseTime: number;
  nodeCount: number;
}

export interface OutlineItem {
  nodeId: string;
  tagName: string;
  detail: string;
  children: OutlineItem[];
}

export interface NodeTrailItem {
  nodeId: string;
  tagName: string;
  detail: string;
}

export type NodeIdentityKind = "document" | "doctype" | "element" | "text" | "comment";

export function createNodeId(kind: NodeIdentityKind, nodeName: string, structuralPath: readonly number[]): string;
export function parseHTML(html: string): ParseResult;
export class NodeMapManager {
  update(map: Map<string, SourceLocation>): void;
  getLocation(nodeId: string): SourceLocation | null;
  findNodeAtOffset(offset: number): string | null;
  findNodeAtPosition(line: number, col: number): string | null;
  getAllNodeIds(): string[];
  clear(): void;
}
export function buildDocumentOutline(root: HyloNode): OutlineItem[];
export function countOutlineItems(items: OutlineItem[]): number;
export function findNodeTrail(root: HyloNode, nodeId: string): NodeTrailItem[];
export function normalizeExportDocument(html: string, options?: { baseHref?: string }): string;
export function shouldParseInWorker(contentLength: number, threshold?: number): boolean;

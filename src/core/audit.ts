// ============================================================
// audit — 离线文档审阅（面向 AI 生成 HTML 的常见问题）
// ============================================================
//
// 纯函数：不联网、不依赖 DOM，便于单测；发现的问题都带 nodeId，
// 点击即可在源码/预览中定位。

import type { HyloNode } from "@/types";

export type AuditRule =
  | "missing-alt"
  | "remote-resource"
  | "empty-link"
  | "duplicate-id"
  | "heading-jump"
  | "inline-style"
  | "blocked-script";

export type AuditSeverity = "warning" | "info";

export interface AuditFinding {
  id: string;
  rule: AuditRule;
  severity: AuditSeverity;
  nodeId: string | null;
  /** 简短补充信息（标签名 / 属性值 / 数量），由 UI 拼接展示 */
  detail?: string;
}

export interface AuditReport {
  findings: AuditFinding[];
  counts: Partial<Record<AuditRule, number>>;
}

const MAX_FINDINGS = 200;
const REMOTE_URL = /^(?:https?:)?\/\//i;
const HEADING = /^h([1-6])$/;

function elementAttrs(node: HyloNode): Record<string, string> {
  return node.attrs ?? {};
}

function pushFinding(
  report: AuditReport,
  rule: AuditRule,
  severity: AuditSeverity,
  nodeId: string | null,
  detail?: string,
) {
  report.counts[rule] = (report.counts[rule] ?? 0) + 1;
  if (report.findings.length >= MAX_FINDINGS) return;
  report.findings.push({
    id: `${rule}:${nodeId ?? report.findings.length}`,
    rule,
    severity,
    nodeId,
    detail,
  });
}

export function auditDocument(root: HyloNode | null): AuditReport {
  const report: AuditReport = { findings: [], counts: {} };
  if (!root) return report;

  const seenIds = new Set<string>();
  let lastHeadingLevel = 0;

  const visit = (node: HyloNode) => {
    if (node.type === "element" && node.tagName) {
      const tag = node.tagName.toLowerCase();
      const attrs = elementAttrs(node);

      // 图片缺少 alt
      if (tag === "img" || (tag === "input" && attrs.type === "image")) {
        if (!("alt" in attrs) || attrs.alt.trim() === "") {
          pushFinding(report, "missing-alt", "warning", node.nodeId, `<${tag}>`);
        }
      }

      // 远程资源（离线/安全预览下不会加载）
      for (const name of ["src", "href", "poster", "data", "srcset"]) {
        const value = attrs[name];
        if (value && REMOTE_URL.test(value.trim())) {
          pushFinding(report, "remote-resource", "info", node.nodeId, `<${tag} ${name}>`);
          break;
        }
      }

      // 空链接
      if (tag === "a") {
        const href = (attrs.href ?? "").trim();
        if (!href || href === "#" || /^javascript:/i.test(href)) {
          pushFinding(report, "empty-link", "warning", node.nodeId, `<a>`);
        }
      }

      // 重复 id
      const id = attrs.id?.trim();
      if (id) {
        if (seenIds.has(id)) {
          pushFinding(report, "duplicate-id", "warning", node.nodeId, `#${id}`);
        } else {
          seenIds.add(id);
        }
      }

      // 标题层级跳级
      const heading = HEADING.exec(tag);
      if (heading) {
        const level = Number(heading[1]);
        if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
          pushFinding(
            report,
            "heading-jump",
            "warning",
            node.nodeId,
            `h${lastHeadingLevel} → h${level}`,
          );
        }
        lastHeadingLevel = level;
      }

      // 内联样式
      if (attrs.style && attrs.style.trim()) {
        pushFinding(report, "inline-style", "info", node.nodeId, `<${tag}>`);
      }

      // 安全预览会阻止的脚本
      if (tag === "script") {
        pushFinding(report, "blocked-script", "info", node.nodeId, attrs.src || "inline");
      }
    }

    for (const child of node.children ?? []) visit(child);
  };

  visit(root);
  return report;
}

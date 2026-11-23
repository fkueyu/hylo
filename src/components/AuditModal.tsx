import { useEffect } from "react";
import { t, type Locale, type TranslationKey } from "@/i18n";
import type { AuditFinding, AuditReport, AuditRule } from "@/core/audit";

interface AuditModalProps {
  isOpen: boolean;
  locale: Locale;
  report: AuditReport;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

const RULE_TEXT: Record<AuditRule, TranslationKey> = {
  "missing-alt": "auditMissingAlt",
  "remote-resource": "auditRemoteResource",
  "empty-link": "auditEmptyLink",
  "duplicate-id": "auditDuplicateId",
  "heading-jump": "auditHeadingJump",
  "inline-style": "auditInlineStyle",
  "blocked-script": "auditBlockedScript",
};

function describeFinding(locale: Locale, finding: AuditFinding): string {
  const base = t(locale, RULE_TEXT[finding.rule]);
  return finding.detail ? `${base} · ${finding.detail}` : base;
}

/** 离线文档审阅结果（面向 AI 生成 HTML 的常见问题清单）。 */
export function AuditModal({ isOpen, locale, report, onSelectNode, onClose }: AuditModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const counts = report.counts;
  const entries = Object.entries(counts) as Array<[AuditRule, number]>;

  return (
    <div className="update-overlay" onClick={onClose}>
      <div
        className="update-modal audit-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, "auditTitle")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="update-modal__header">
          <span className="update-modal__icon">🔍</span>
          <span className="update-modal__title">
            {t(locale, "auditTitle")} · {report.findings.length} {t(locale, "auditItems")}
          </span>
        </div>
        <div className="update-modal__content">
          {entries.length > 0 && (
            <div className="audit-modal__counts">
              {entries.map(([rule, count]) => (
                <span key={rule} className="audit-modal__chip">
                  {t(locale, RULE_TEXT[rule])} {count}
                </span>
              ))}
            </div>
          )}
          {report.findings.length === 0 ? (
            <p className="audit-modal__clean">{t(locale, "auditEmpty")}</p>
          ) : (
            <ul className="audit-modal__list">
              {report.findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    className={`audit-modal__finding audit-modal__finding--${finding.severity}`}
                    onClick={() => {
                      if (finding.nodeId) onSelectNode(finding.nodeId);
                      onClose();
                    }}
                    disabled={!finding.nodeId}
                    title={t(locale, "auditLocate")}
                  >
                    <span className="audit-modal__dot" aria-hidden="true" />
                    <span>{describeFinding(locale, finding)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="update-modal__footer audit-modal__footer">
          <button
            type="button"
            className="update-modal__btn update-modal__btn--secondary"
            onClick={onClose}
          >
            {t(locale, "auditClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { t, type Locale } from "@/i18n";

export type PasteMode = "replace" | "insert" | "new";

interface PasteHtmlModalProps {
  isOpen: boolean;
  locale: Locale;
  html: string;
  onChoose: (mode: PasteMode) => void;
  onClose: () => void;
}

/** 粘贴 AI HTML 时的三选一：替换当前 / 插入光标处 / 新建文档。 */
export function PasteHtmlModal({ isOpen, locale, html, onChoose, onClose }: PasteHtmlModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const lines = html.split("\n").length;

  return (
    <div className="update-overlay" onClick={onClose}>
      <div
        className="update-modal paste-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, "pasteModeTitle")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="update-modal__header">
          <span className="update-modal__icon">📋</span>
          <span className="update-modal__title">{t(locale, "pasteModeTitle")}</span>
        </div>
        <div className="update-modal__content">
          <p style={{ marginTop: 0 }}>{t(locale, "pasteModeDesc")}</p>
          <div className="paste-modal__snippet">
            <div className="paste-modal__snippet-label">
              {t(locale, "pasteModeSnippet")} · {html.length} chars / {lines} lines
            </div>
            <pre>{html.slice(0, 480)}{html.length > 480 ? "\n…" : ""}</pre>
          </div>
        </div>
        <div className="update-modal__footer paste-modal__footer">
          <button
            type="button"
            className="update-modal__btn update-modal__btn--secondary"
            onClick={onClose}
          >
            {t(locale, "confirmCancel")}
          </button>
          <button
            type="button"
            className="update-modal__btn"
            onClick={() => onChoose("new")}
          >
            {t(locale, "pasteModeNew")}
          </button>
          <button
            type="button"
            className="update-modal__btn"
            onClick={() => onChoose("insert")}
          >
            {t(locale, "pasteModeInsert")}
          </button>
          <button
            type="button"
            className="update-modal__btn update-modal__btn--primary"
            onClick={() => onChoose("replace")}
          >
            {t(locale, "pasteModeReplace")}
          </button>
        </div>
      </div>
    </div>
  );
}

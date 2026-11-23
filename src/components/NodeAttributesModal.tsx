import { useEffect, useMemo, useState } from "react";
import { t, type Locale } from "@/i18n";

interface AttributeRow {
  key: string;
  name: string;
  value: string;
}

interface NodeAttributesModalProps {
  isOpen: boolean;
  locale: Locale;
  tagName: string;
  attrs: Record<string, string>;
  onSave: (attrs: Record<string, string>) => void;
  onClose: () => void;
}

const ATTRIBUTE_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;

/** 选中元素的属性快速编辑（写回源码 start-tag）。 */
export function NodeAttributesModal({
  isOpen,
  locale,
  tagName,
  attrs,
  onSave,
  onClose,
}: NodeAttributesModalProps) {
  const [rows, setRows] = useState<AttributeRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setRows(
      Object.entries(attrs).map(([name, value], index) => ({
        key: `${name}-${index}`,
        name,
        value,
      })),
    );
  }, [isOpen, attrs]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const error = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.name.trim()) return t(locale, "attrNameRequired");
      if (!ATTRIBUTE_NAME.test(row.name.trim())) return t(locale, "attrNameInvalid");
      const normalized = row.name.trim().toLowerCase();
      if (seen.has(normalized)) return t(locale, "attrNameDuplicate");
      seen.add(normalized);
    }
    return null;
  }, [rows, locale]);

  if (!isOpen) return null;

  const updateRow = (key: string, patch: Partial<AttributeRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleSave = () => {
    if (error) return;
    const next: Record<string, string> = {};
    for (const row of rows) next[row.name.trim()] = row.value;
    onSave(next);
  };

  return (
    <div className="update-overlay" onClick={onClose}>
      <div
        className="update-modal attributes-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, "editAttributes")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="update-modal__header">
          <span className="update-modal__icon">🏷️</span>
          <span className="update-modal__title">
            {t(locale, "editAttributes")} · &lt;{tagName}&gt;
          </span>
        </div>
        <div className="update-modal__content">
          <div className="attributes-modal__head">
            <span>{t(locale, "attrName")}</span>
            <span>{t(locale, "attrValue")}</span>
            <span />
          </div>
          <div className="attributes-modal__rows">
            {rows.length === 0 && (
              <p className="attributes-modal__empty">{t(locale, "attrEmptyHint")}</p>
            )}
            {rows.map((row) => (
              <div className="attributes-modal__row" key={row.key}>
                <input
                  className="attributes-modal__input"
                  value={row.name}
                  spellCheck={false}
                  onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  aria-label={t(locale, "attrName")}
                />
                <input
                  className="attributes-modal__input"
                  value={row.value}
                  spellCheck={false}
                  onChange={(event) => updateRow(row.key, { value: event.target.value })}
                  aria-label={t(locale, "attrValue")}
                />
                <button
                  type="button"
                  className="attributes-modal__remove"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  title={t(locale, "removeAttribute")}
                  aria-label={t(locale, "removeAttribute")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {error && <p className="attributes-modal__error">{error}</p>}
          <button
            type="button"
            className="attributes-modal__add"
            onClick={() =>
              setRows((current) => [
                ...current,
                { key: `new-${Date.now()}-${current.length}`, name: "", value: "" },
              ])
            }
          >
            + {t(locale, "addAttribute")}
          </button>
        </div>
        <div className="update-modal__footer attributes-modal__footer">
          <button
            type="button"
            className="update-modal__btn update-modal__btn--secondary"
            onClick={onClose}
          >
            {t(locale, "confirmCancel")}
          </button>
          <button
            type="button"
            className="update-modal__btn update-modal__btn--primary"
            disabled={Boolean(error)}
            onClick={handleSave}
          >
            {t(locale, "saveAttributes")}
          </button>
        </div>
      </div>
    </div>
  );
}

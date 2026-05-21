// ============================================================
// HistoryModal.tsx — 历史记录弹窗组件
// ============================================================

import { readTextFile } from "@tauri-apps/plugin-fs";
import { ask } from "@tauri-apps/plugin-dialog";
import { t, Locale } from "../i18n";
import { HistoryItem } from "../hooks/useHistory";

interface HistoryModalProps {
  isOpen: boolean;
  locale: Locale;
  history: HistoryItem[];
  onClose: () => void;
  onFileLoaded: (content: string, filename: string, filepath: string) => void;
  onClear: () => void;
  onRemove: (path: string) => void;
}

export function HistoryModal({
  isOpen,
  locale,
  history,
  onClose,
  onFileLoaded,
  onClear,
  onRemove,
}: HistoryModalProps) {
  if (!isOpen) return null;

  const handleItemClick = async (item: HistoryItem) => {
    try {
      const content = await readTextFile(item.path);
      onFileLoaded(content, item.name, item.path);
      onClose();
    } catch (err) {
      console.error("Failed to read historical file", err);
      const confirmRemove = await ask(
        t(locale, "fileNotExistDesc"),
        {
          title: t(locale, "fileNotExistTitle"),
          kind: "warning",
          okLabel: t(locale, "confirmOk"),
          cancelLabel: t(locale, "confirmCancel"),
        }
      );
      if (confirmRemove) {
        onRemove(item.path);
      }
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="update-overlay" onClick={onClose}>
      <div className="update-modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-modal__header">
          <span className="update-modal__icon">🕒</span>
          <span className="update-modal__title">{t(locale, "historyTitle")}</span>
        </div>

        <div className="update-modal__content history-modal__content">
          {history.length === 0 ? (
            <div className="history-modal__empty">
              ☕ {t(locale, "historyEmpty")}
            </div>
          ) : (
            <div className="history-modal__list">
              {history.map((item) => (
                <button
                  key={item.path}
                  className="history-modal__item"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="history-modal__item-info">
                    <span className="history-modal__item-name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="history-modal__item-path" title={item.path}>
                      {item.path}
                    </span>
                  </div>
                  <span className="history-modal__item-time">
                    {formatTime(item.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="update-modal__footer">
          {history.length > 0 && (
            <button
              className="update-modal__btn update-modal__btn--secondary history-modal__btn-clear"
              onClick={onClear}
            >
              {t(locale, "historyClear")}
            </button>
          )}
          <button className="update-modal__btn update-modal__btn--primary" onClick={onClose}>
            {t(locale, "updateClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

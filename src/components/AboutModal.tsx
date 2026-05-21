// ============================================================
// AboutModal.tsx — 关于页面弹窗组件
// ============================================================

import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { t, Locale } from "../i18n";

interface AboutModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
}

export function AboutModal({ isOpen, locale, onClose }: AboutModalProps) {
  const [version, setVersion] = useState("0.1.8");

  useEffect(() => {
    if (isOpen) {
      getVersion()
        .then(setVersion)
        .catch((err) => console.error("Failed to get app version", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLinkClick = async (url: string) => {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Failed to open URL", err);
    }
  };

  return (
    <div className="update-overlay" onClick={onClose}>
      <div className="update-modal about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-modal__content">
          <div className="about-modal__logo-container">
            <img
              src="/logo.png"
              alt="Hylo Logo"
              className="about-modal__logo"
            />
          </div>
          <h2 className="about-modal__title">Hylo</h2>
          <div className="about-modal__version">Version {version}</div>
          
          <p className="about-modal__description">
            {t(locale, "aboutSlogan")}
          </p>

          <div className="about-modal__links">
            <button
              className="about-modal__link-btn"
              onClick={() => handleLinkClick("https://ainx.ink/hylo/")}
            >
              🌐 {t(locale, "aboutWebsite")}
            </button>
            <button
              className="about-modal__link-btn"
              onClick={() => handleLinkClick("https://github.com/fkueyu/hylo")}
            >
              🐙 GitHub
            </button>
            <button
              className="about-modal__link-btn"
              onClick={() => handleLinkClick("https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview")}
            >
              🔌 VS Code
            </button>
          </div>

          <div className="about-modal__copyright">
            © 2026 AINX. All rights reserved.
          </div>
        </div>

        <div className="update-modal__footer about-modal__footer">
          <button className="update-modal__btn update-modal__btn--primary" onClick={onClose}>
            {t(locale, "updateClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

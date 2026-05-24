import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { t, Locale } from "../i18n";
import { openUrl } from "@tauri-apps/plugin-opener";

export interface UpdateModalRef {
  checkUpdates: (isManual: boolean) => Promise<void>;
}

interface UpdateModalProps {
  locale: Locale;
}

export const UpdateModal = forwardRef<UpdateModalRef, UpdateModalProps>(({ locale }, ref) => {
  const isMac = typeof window !== "undefined" && navigator.userAgent.includes("Mac");
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<
    "checking" | "idle" | "available" | "downloading" | "success" | "error" | "already-latest"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body?: string } | null>(null);
  const [updateInstance, setUpdateInstance] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const checkUpdates = async (isManual: boolean) => {
    try {
      if (isManual) {
        setIsOpen(true);
        setStatus("checking");
      }

      const update = await check();

      if (update) {
        setUpdateInstance(update);
        setUpdateInfo({
          version: update.version,
          body: update.body,
        });
        setStatus("available");
        setIsOpen(true);
      } else {
        if (isManual) {
          setStatus("already-latest");
        }
      }
    } catch (e: any) {
      console.error("Update check failed", e);
      if (isManual) {
        setStatus("error");
        setErrorMsg(e?.message || String(e));
      }
    }
  };

  useImperativeHandle(ref, () => ({
    checkUpdates,
  }));

  // 启动自动检测更新 (静默检查)
  useEffect(() => {
    if (import.meta.env.VITE_APP_STORE === "true") return;
    const timer = setTimeout(() => {
      checkUpdates(false);
    }, 4000); // 启动 4 秒后静默请求
    return () => clearTimeout(timer);
  }, []);

  const handleStartUpdate = async () => {
    if (!updateInstance) return;
    setStatus("downloading");
    setProgress(0);

    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await updateInstance.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data?.contentLength || 0;
            break;
          case "Progress":
            downloadedBytes += event.data?.chunkLength || 0;
            if (totalBytes > 0) {
              const pct = Math.round((downloadedBytes / totalBytes) * 100);
              setProgress(pct);
            }
            break;
          case "Finished":
            break;
        }
      });

      setStatus("success");
      // 成功后自动重启应用
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (e) {
          console.error("Failed to relaunch app", e);
        }
      }, 1500);
    } catch (e: any) {
      console.error("Failed to download and install update", e);
      setStatus("error");
      setErrorMsg(e?.message || String(e));
    }
  };

  const handleClose = () => {
    if (status === "downloading") return; // 正在下载安装时禁止关闭
    setIsOpen(false);
    // 渐隐动画结束后重置状态
    setTimeout(() => {
      setStatus("idle");
      setProgress(0);
      setUpdateInfo(null);
      setUpdateInstance(null);
      setErrorMsg("");
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div className="update-overlay" onClick={handleClose}>
      <div className="update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-modal__header">
          <span className="update-modal__icon">✨</span>
          <span className="update-modal__title">{t(locale, "updateTitle")}</span>
        </div>

        <div className="update-modal__content">
          {status === "checking" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div>⏳ {t(locale, "updateChecking")}</div>
            </div>
          )}

          {status === "already-latest" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div>✅ {t(locale, "updateAlreadyLatest")}</div>
            </div>
          )}

          {status === "error" && (
            <div style={{ padding: "8px 0" }}>
              <div style={{ color: "#ff453a", fontWeight: 600, marginBottom: "8px" }}>
                ❌ {t(locale, "updateError")}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", wordBreak: "break-all" }}>
                {errorMsg}
              </div>
            </div>
          )}

          {status === "available" && updateInfo && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "8px" }}>🎉 {t(locale, "updateFound")}</div>
              <div className="update-modal__version-info">
                <div>
                  <span className="update-modal__version-label">{t(locale, "updateLatest")}：</span>
                  <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>v{updateInfo.version}</span>
                </div>
              </div>

              {/* 仅在 Mac 下显示 App Store 迁移提示 */}
              {isMac && (
                <div style={{ 
                  marginTop: "12px", 
                  padding: "10px 12px", 
                  backgroundColor: "rgba(0, 200, 150, 0.08)", 
                  border: "1px solid rgba(0, 200, 150, 0.2)", 
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#00b080" 
                }}>
                  {locale === "zh" ? (
                    <>💡 推荐 macOS 用户前往 <strong>Mac App Store</strong> 下载安装全新上架的正版客户端，可支持完整的多语言原生系统菜单并享受更安全稳定的沙盒环境。</>
                  ) : (
                    <>💡 We highly recommend macOS users install via the <strong>Mac App Store</strong> to experience the fully localized native menus and a secure sandboxed environment.</>
                  )}
                </div>
              )}

              {updateInfo.body && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ marginBottom: "6px", fontSize: "11px", fontWeight: 500 }}>RELEASE NOTES:</div>
                  <div className="update-modal__notes">{updateInfo.body}</div>
                </div>
              )}
            </div>
          )}

          {status === "downloading" && (
            <div className="update-modal__progress-container">
              <div style={{ fontWeight: 500 }}>⚡ {t(locale, "updateDownloading")}</div>
              <div className="update-modal__progress-bar">
                <div className="update-modal__progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="update-modal__progress-text">{progress}%</div>
            </div>
          )}

          {status === "success" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ color: "#30d158", fontWeight: 600, marginBottom: "8px" }}>🚀 {t(locale, "updateSuccess")}</div>
            </div>
          )}
        </div>

        <div className="update-modal__footer">
          {status === "available" && (
            <>
              <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
                {t(locale, "updateBtnLater")}
              </button>
              {isMac && (
                <button 
                  className="update-modal__btn" 
                  style={{
                    backgroundColor: "#00c896",
                    color: "#fff",
                    border: "none"
                  }}
                  onClick={async () => {
                    await openUrl("https://apps.apple.com/cn/app/hylo-editor/id6771771702?mt=12");
                    handleClose();
                  }}
                >
                  {locale === "zh" ? "前往 App Store" : "App Store"}
                </button>
              )}
              <button className="update-modal__btn update-modal__btn--primary" onClick={handleStartUpdate}>
                {t(locale, "updateBtnNow")}
              </button>
            </>
          )}

          {(status === "already-latest" || status === "error") && (
            <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
              {t(locale, "updateClose")}
            </button>
          )}

          {status === "checking" && (
            <button className="update-modal__btn update-modal__btn--secondary" disabled>
              {t(locale, "updateClose")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

UpdateModal.displayName = "UpdateModal";

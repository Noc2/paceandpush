"use client";

import QRCode from "qrcode";
import { useEffect, useId, useState } from "react";
import { brandColors } from "@paceandpush/brand";
import { useThemeSignature } from "./useThemeSignature";

type DownloadTarget = {
  id: "ios" | "android";
  label: string;
  storeLabel: string;
  url: string;
};

const downloadTargets: DownloadTarget[] = [
  {
    id: "ios",
    label: "iPhone",
    storeLabel: "App Store",
    url: process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() ?? "",
  },
  {
    id: "android",
    label: "Android",
    storeLabel: "Google Play",
    url: process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() ?? "",
  },
];

export function AppDownloadActions() {
  const titleId = useId();
  const [activeTarget, setActiveTarget] = useState<DownloadTarget | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const themeSignature = useThemeSignature();

  useEffect(() => {
    if (!activeTarget?.url) {
      setQrImageUrl(null);
      return;
    }

    let cancelled = false;
    setQrImageUrl(null);
    setError(null);

    QRCode.toDataURL(activeTarget.url, {
      color: {
        dark: readCssColor("--ink", brandColors.ink),
        light: readCssColor("--surface-bright", brandColors.surfaceBright),
      },
      errorCorrectionLevel: "M",
      margin: 2,
      width: 224,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrImageUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Could not render the QR code.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTarget, themeSignature]);

  useEffect(() => {
    if (!activeTarget) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeTarget]);

  function openModal(target: DownloadTarget) {
    setActiveTarget(target);
    setCopied(false);
    setError(null);
  }

  function closeModal() {
    setActiveTarget(null);
    setCopied(false);
    setError(null);
  }

  async function copyLink() {
    if (!activeTarget?.url) return;

    try {
      await navigator.clipboard.writeText(activeTarget.url);
      setCopied(true);
    } catch {
      setError("Could not copy the link.");
    }
  }

  return (
    <>
      <nav className="top-actions download-actions" aria-label="Download apps">
        {downloadTargets.map((target) => (
          <button
            className="button"
            type="button"
            key={target.id}
            onClick={() => openModal(target)}
          >
            {target.label}
          </button>
        ))}
      </nav>

      {activeTarget ? (
        <div
          className="download-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeModal();
          }}
        >
          <section
            className="download-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="download-modal-header">
              <div>
                <p className="section-label">{activeTarget.storeLabel}</p>
                <h2 id={titleId}>{activeTarget.label} app</h2>
              </div>
              <button
                className="download-modal-close"
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                x
              </button>
            </div>

            {activeTarget.url ? (
              <div className="download-modal-body">
                <div className="download-qr">
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt={`${activeTarget.label} app download QR code`} />
                  ) : (
                    <span>QR</span>
                  )}
                </div>
                <div className="download-link-panel">
                  <span>Download link</span>
                  <code>{activeTarget.url}</code>
                  <div className="download-link-actions">
                    <a className="button button-primary" href={activeTarget.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <button className="button" type="button" onClick={copyLink}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  {error ? <p className="form-error">{error}</p> : null}
                </div>
              </div>
            ) : (
              <div className="download-pending">
                <strong>Link pending</strong>
                <span>Set the store or beta URL before launch.</span>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function readCssColor(name: string, fallback: string): string {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

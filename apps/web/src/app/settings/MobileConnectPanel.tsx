"use client";

import type {
  MobileDeviceSummary,
  PairingCodeResponse,
} from "@paceandpush/api-contracts";
import { brandColors } from "@paceandpush/brand";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

type ApiError = {
  error?: string;
};

export function MobileConnectPanel({
  initialDevices,
}: {
  initialDevices: MobileDeviceSummary[];
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [pairingCode, setPairingCode] = useState<PairingCodeResponse | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pairingCode) {
      setQrImageUrl(null);
      setQrPayload(null);
      return;
    }

    let cancelled = false;
    const payload = buildPairingDeepLink(pairingCode.code, window.location.origin);
    setQrPayload(payload);
    setQrImageUrl(null);

    QRCode.toDataURL(payload, {
      color: {
        dark: brandColors.ink,
        light: brandColors.surfaceBright,
      },
      errorCorrectionLevel: "M",
      margin: 2,
      width: 224,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrImageUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not render the QR code. Copy the code instead.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pairingCode]);

  async function createPairingCode() {
    setBusy(true);
    setCopied(false);
    setError(null);

    try {
      const response = await fetch("/api/mobile/pairing-codes", { method: "POST" });
      const body = (await response.json()) as PairingCodeResponse & ApiError;
      if (!response.ok) {
        throw new Error(body.error || "Could not create a pairing code.");
      }
      setPairingCode(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a pairing code.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPairingCode() {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode.code);
      setCopied(true);
    } catch {
      setError("Could not copy the pairing code.");
    }
  }

  async function revokeDevice(deviceId: string) {
    setRevokingId(deviceId);
    setError(null);

    try {
      const response = await fetch(
        `/api/mobile/devices/${encodeURIComponent(deviceId)}/revoke`,
        { method: "POST" },
      );
      const body = (await response.json()) as MobileDeviceSummary & ApiError;
      if (!response.ok) {
        throw new Error(body.error || "Could not revoke this device.");
      }
      setDevices((current) =>
        current.map((device) => (device.id === body.id ? body : device)),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke this device.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="mobile-connect-panel">
      <div className="pairing-code-card">
        <div>
          <h3>Pair a device</h3>
          <p>Codes expire after 10 minutes. Scan the QR code or paste the code into the phone app.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={createPairingCode}
          disabled={busy}
        >
          {busy ? "Creating..." : "Create pairing code"}
        </button>
      </div>

      {pairingCode ? (
        <div className="pairing-code-result" aria-live="polite">
          <div className="pairing-code-qr">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="Mobile pairing QR code" />
            ) : (
              <span>Rendering QR...</span>
            )}
          </div>
          <div className="pairing-code-copy">
            <span>Pairing code</span>
            <code>{pairingCode.code}</code>
            <div>
              <span>Expires {formatDateTime(pairingCode.expiresAt)}</span>
              <button className="button" type="button" onClick={copyPairingCode}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {qrPayload ? <span className="pairing-code-hint">Scan with Pace & Push mobile.</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="device-list" aria-label="Connected devices">
        <h3>Connected devices</h3>
        {devices.length === 0 ? (
          <p>No devices connected yet.</p>
        ) : (
          devices.map((device) => (
            <div className="device-row" key={device.id}>
              <div>
                <strong>{device.label}</strong>
                <span>
                  {device.platform.toUpperCase()} ·{" "}
                  {device.lastSeenAt
                    ? `Last seen ${formatDateTime(device.lastSeenAt)}`
                    : "Never synced"}
                </span>
              </div>
              {device.revoked ? (
                <span className="status-pill">Revoked</span>
              ) : (
                <button
                  className="button"
                  type="button"
                  onClick={() => revokeDevice(device.id)}
                  disabled={revokingId === device.id}
                >
                  {revokingId === device.id ? "Revoking..." : "Revoke"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildPairingDeepLink(code: string, baseUrl: string): string {
  const payload = new URL("pacepush://pair");
  payload.searchParams.set("code", code);
  payload.searchParams.set("baseUrl", baseUrl);
  return payload.toString();
}

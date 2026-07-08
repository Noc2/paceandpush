"use client";

import { useEffect, useState } from "react";

export function useThemeSignature() {
  const [signature, setSignature] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function updateSignature() {
      const styles = window.getComputedStyle(document.documentElement);
      setSignature(
        [
          document.documentElement.dataset.theme ?? "system",
          styles.getPropertyValue("--ink").trim(),
          styles.getPropertyValue("--surface-bright").trim(),
        ].join(":"),
      );
    }

    updateSignature();
    media.addEventListener("change", updateSignature);
    window.addEventListener("storage", updateSignature);
    window.addEventListener("pace-theme-change", updateSignature);

    return () => {
      media.removeEventListener("change", updateSignature);
      window.removeEventListener("storage", updateSignature);
      window.removeEventListener("pace-theme-change", updateSignature);
    };
  }, []);

  return signature;
}

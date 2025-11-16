import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface UseBarcodeScannerOptions {
  readerId: string;
  onScan: (text: string) => void;
  scanDelayMs?: number;
  formatsToSupport?: number[];
  blockInIframe?: boolean;
}

interface UseBarcodeScannerResult {
  status: "idle" | "requesting" | "active" | "error";
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const SCANNING_STATE = { NOT_STARTED: 0, PAUSED: 1, SCANNING: 2 } as const;

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function mapCameraError(err: any): string {
  const name = err?.name || err?.code || "";
  const msg = String(err?.message || "");

  if (name.includes("NotAllowed") || name.includes("PermissionDenied")) {
    return "Доступ к камере запрещен. Разрешите доступ в настройках браузера.";
  }
  if (name.includes("NotFound")) {
    return "Камера не найдена на устройстве.";
  }
  if (name.includes("Overconstrained") || msg.includes("overconstrained")) {
    return "Не удалось открыть выбранную камеру. Попробуйте другую камеру.";
  }
  if (name.includes("NotReadable")) {
    return "Камера занята другим приложением. Закройте другие приложения с камерой.";
  }
  if (msg.includes("iframe") || msg.includes("Feature-Policy") || msg.includes("Permissions-Policy")) {
    return "Режим предпросмотра блокирует камеру. Откройте приложение в новой вкладке.";
  }
  return "Не удалось запустить камеру. Проверьте разрешения и попробуйте снова.";
}

export function useBarcodeScanner({
  readerId,
  onScan,
  scanDelayMs = 2000,
  formatsToSupport = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.QR_CODE,
  ],
  blockInIframe = true,
}: UseBarcodeScannerOptions): UseBarcodeScannerResult {
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef(0);
  const lastScannedRef = useRef("");

  const [status, setStatus] = useState<"idle" | "requesting" | "active" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanupExisting = useCallback(async () => {
    if (html5Ref.current) {
      try {
        const state = (html5Ref.current as any).getState?.();
        if (state === SCANNING_STATE.SCANNING) {
          await html5Ref.current.stop();
        }
      } catch {
        // ignore
      }
      html5Ref.current = null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: "environment" } } as any,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // release the temporary stream immediately so scanner can take over
    stream.getTracks().forEach((t) => t.stop());
  }, []);

  const pickCameraId = useCallback(async (): Promise<string | undefined> => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) return undefined;
      const preferred = devices.find((d) => /back|rear|environment/i.test(d?.label || ""));
      return preferred?.id || devices[0].id;
    } catch {
      return undefined;
    }
  }, []);

  const start = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("error");
        setErrorMessage("Браузер не поддерживает доступ к камере.");
        return;
      }

      if (blockInIframe && isInIframe()) {
        setStatus("error");
        setErrorMessage("Режим предпросмотра блокирует камеру. Откройте приложение в новой вкладке.");
        return;
      }

      setStatus("requesting");
      setErrorMessage(null);

      await cleanupExisting();

      // Prompt permission early so labels are populated on Android/iOS
      try {
        await requestPermission();
      } catch (e: any) {
        setStatus("error");
        setErrorMessage(mapCameraError(e));
        throw e;
      }

      const instance = new Html5Qrcode(readerId, { verbose: false, formatsToSupport });
      html5Ref.current = instance;

      const cameraId = await pickCameraId();
      const constraints: any = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      await instance.start(
        constraints,
        { fps: 12, qrbox: { width: 320, height: 120 } },
        (decodedText) => {
          const now = Date.now();
          if (
            decodedText &&
            (decodedText !== lastScannedRef.current || now - lastScanTimeRef.current > scanDelayMs)
          ) {
            lastScannedRef.current = decodedText;
            lastScanTimeRef.current = now;
            onScan(decodedText);
          }
        },
        () => {
          // ignore scan errors while searching
        }
      );

      setStatus("active");
    } catch (e: any) {
      console.error("Scanner start error:", e);
      setStatus("error");
      setErrorMessage(mapCameraError(e));
      // Attempt to cleanup to allow retry
      await cleanupExisting();
      throw e;
    }
  }, [blockInIframe, cleanupExisting, formatsToSupport, pickCameraId, readerId, requestPermission, scanDelayMs, onScan]);

  const stop = useCallback(async () => {
    try {
      if (html5Ref.current) {
        const state = (html5Ref.current as any).getState?.();
        if (state === SCANNING_STATE.SCANNING) {
          await html5Ref.current.stop();
        }
        html5Ref.current = null;
      }
    } finally {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    return () => {
      // ensure camera is released on unmount
      stop().catch(() => {});
    };
  }, [stop]);

  return { status, errorMessage, start, stop };
}

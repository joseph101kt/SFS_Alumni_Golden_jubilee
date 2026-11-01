'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onCode: (code: string) => void;
  paused?: boolean;
};

export default function GateQrScanner({ onCode, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const lastRef = useRef('');

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!Detector) {
        setSupported(false);
        setError('Camera QR scan needs a newer Chrome/Safari. Type the registration ID below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue?.trim();
            if (raw && raw !== lastRef.current) {
              lastRef.current = raw;
              onCode(raw);
            }
          } catch {
            /* frame miss */
          }
          timer = window.setTimeout(tick, 350);
        };
        timer = window.setTimeout(tick, 400);
      } catch {
        setError('Camera permission denied. Type the registration ID instead.');
        setSupported(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode, paused]);

  return (
    <div className="rounded-2xl overflow-hidden border border-primary/15 bg-black/90">
      {supported ? (
        <video ref={videoRef} className="w-full aspect-[3/4] max-h-[420px] object-cover" muted playsInline />
      ) : (
        <div className="p-6 text-body-sm text-white/90">{error || 'Scanner unavailable'}</div>
      )}
      {error && supported ? <p className="p-3 text-body-sm text-jubilee-gold-light bg-primary">{error}</p> : null}
    </div>
  );
}

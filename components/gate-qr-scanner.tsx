'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onCode: (code: string) => void;
  paused?: boolean;
};

type BarcodeDetectorLike = {
  detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export default function GateQrScanner({ onCode, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const lastRef = useRef('');

  // Clear detected state and last scanned reference when unpaused (e.g. Next guest)
  useEffect(() => {
    if (!paused) {
      setDetectedValue(null);
      lastRef.current = '';
    }
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;
    let jsQR: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    async function start() {
      setError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setLive(false);
        setError('This browser has no camera API. Type the registration ID below.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        setLive(false);
        setError('Camera permission denied. Type the registration ID instead.');
        return;
      }

      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setLive(true);

      const Detector = window.BarcodeDetector;
      let detector: BarcodeDetectorLike | null = null;
      if (Detector) {
        try {
          detector = new Detector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }

      if (!detector) {
        const mod = await import('jsqr');
        jsQR = mod.default;
      }

      const tick = async () => {
        if (cancelled || !videoRef.current) return;
        const v = videoRef.current;
        if (v.readyState < 2) {
          timer = window.setTimeout(tick, 250);
          return;
        }

        try {
          let raw = '';
          if (detector) {
            const codes = await detector.detect(v);
            raw = codes[0]?.rawValue?.trim() || '';
          } else if (jsQR && canvasRef.current) {
            const canvas = canvasRef.current;
            const w = v.videoWidth || 640;
            const h = v.videoHeight || 480;
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, w, h);
                const image = ctx.getImageData(0, 0, w, h);
                const hit = jsQR(image.data, image.width, image.height);
                raw = hit?.data?.trim() || '';
              }
            }
          }

          if (raw && raw !== lastRef.current) {
            lastRef.current = raw;
            setDetectedValue(raw);
            onCode(raw);
          }
        } catch {
          /* frame miss */
        }
        timer = window.setTimeout(tick, detector ? 350 : 200);
      };

      timer = window.setTimeout(tick, 400);
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode, paused]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-primary/15 bg-black/90">
      <video
        ref={videoRef}
        className={`w-full aspect-[3/4] max-h-[420px] object-cover ${live ? '' : 'hidden'}`}
        muted
        playsInline
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden />

      {/* Visual Targeting Frame Overlay */}
      {live && !paused && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <div className="w-48 h-48 border-2 border-dashed border-jubilee-gold-light/60 rounded-xl flex items-center justify-center">
            <span className="text-[10px] tracking-widest text-white/50 uppercase">Align QR Code</span>
          </div>
        </div>
      )}

      {/* Scanned Badge Notification over camera */}
      {detectedValue && (
        <div className="absolute bottom-3 left-3 right-3 bg-primary/90 text-on-primary px-3 py-2 rounded-lg text-xs tracking-wider flex justify-between items-center backdrop-blur-sm animate-fade-in">
          <span className="truncate">Scanned: {detectedValue}</span>
          <span className="text-[10px] text-jubilee-gold-light uppercase font-bold">Processing</span>
        </div>
      )}

      {!live && (
        <div className="p-6 text-body-sm text-white/90">
          {error || 'Starting camera…'}
        </div>
      )}
      {error && live ? (
        <p className="p-3 text-body-sm text-jubilee-gold-light bg-primary">{error}</p>
      ) : null}
    </div>
  );
}
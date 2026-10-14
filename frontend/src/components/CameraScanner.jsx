import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, CameraOff } from 'lucide-react';

export default function CameraScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let mounted = true;
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, controls) => {
      if (controls && !controlsRef.current) controlsRef.current = controls;
      if (result && mounted) {
        const value = result.getText();
        if (value) { mounted = false; controlsRef.current?.stop(); onCode(value); }
      }
    }).catch((e) => setError(e?.message || 'No se pudo abrir la cámara. Revisa los permisos del navegador.'));
    return () => { mounted = false; controlsRef.current?.stop(); controlsRef.current = null; reader.reset?.(); };
  }, [onCode]);
  return <div className="camera-box"><div className="camera-head"><span><Camera size={18}/> Escáner de cámara</span><button className="icon-btn" onClick={onClose} aria-label="Cerrar cámara"><CameraOff size={18}/></button></div><video ref={videoRef} className="camera-video" muted playsInline /><p className="muted small">Centra el código de barras dentro de la imagen.</p>{error && <p className="error-text">{error}. También puedes usar el escáner físico como teclado.</p>}</div>;
}

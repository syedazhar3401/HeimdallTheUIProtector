import React, { useState, useEffect, useRef, DragEvent, ChangeEvent, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Loader2, Sparkles, AlertCircle, Key, Bot, CheckCircle, Shield, Eye, Zap } from 'lucide-react';
import ChatBox from './ChatBox';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// GIF background path — encoded for the space in filename
const BG_GIF = '/backgrounds/app%20background.gif';

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        try {
          const result = await window.aistudio.hasSelectedApiKey();
          setHasKey(result);
        } catch (e) {
          console.error(e);
          setHasKey(false);
        }
      } else {
        setHasKey(true);
      }
      setCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // ── Shared full-screen GIF background wrapper ──
  const GifBackground = () => (
    <>
      {/* Full-screen looping GIF — fills entire viewport */}
      <img
        src={BG_GIF}
        alt=""
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Minimal gradient overlay — just enough for text contrast, NOT hiding the GIF */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,12,15,0.45) 0%, rgba(8,12,15,0.25) 40%, rgba(8,12,15,0.55) 100%)',
      }} />
    </>
  );

  if (checkingKey) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <GifBackground />
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="sigil-orb">
            <span style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 22 }}>ᚺ</span>
          </div>
          <p style={{ fontFamily: 'Cinzel, serif', color: 'rgba(212,175,55,0.6)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
            Awakening…
          </p>
        </div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
        <GifBackground />
        <div className="glass-card" style={{ position: 'relative', zIndex: 10, maxWidth: 360, width: '100%', padding: 32, textAlign: 'center' }}>
          <div className="corner-decoration corner-tl" />
          <div className="corner-decoration corner-tr" />
          <div className="corner-decoration corner-bl" />
          <div className="corner-decoration corner-br" />
          <div className="sigil-orb" style={{ margin: '0 auto 24px' }}>
            <Key style={{ width: 22, height: 22, color: '#d4af37' }} />
          </div>
          <h1 className="rune-font" style={{ color: '#d4af37', fontSize: 22, marginBottom: 8 }}>Entry Required</h1>
          <p style={{ fontFamily: 'Josefin Sans, sans-serif', color: '#a09070', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            Seeker, present your key to cross the Bifrost.{' '}
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer"
              style={{ color: '#d4af37', textDecoration: 'underline', textDecorationColor: 'rgba(212,175,55,0.3)' }}>
              Acquire from the Allfather.
            </a>
          </p>
          <button onClick={handleSelectKey} className="btn-bifrost">
            <Shield style={{ width: 16, height: 16 }} />
            Present Key
          </button>
        </div>
      </div>
    );
  }

  return <MainApp onKeyError={() => setHasKey(false)} gifBackground={<GifBackground />} />;
}

type Stage = 'idle' | 'processing' | 'ready' | 'chatting';

function MainApp({ onKeyError, gifBackground }: { onKeyError: () => void; gifBackground: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [stage, setStage] = useState<Stage>('idle');
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressIdx, setProgressIdx] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const STEPS = [
    { icon: Eye, label: 'Scrying the sketch', sub: 'Vision analysis' },
    { icon: Zap, label: 'Forging the UI', sub: 'Image generation' },
    { icon: Bot, label: 'Ready for Devstral', sub: 'Awaiting summon' },
  ];

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
        else reject(new Error('Failed to read file'));
      };
      reader.onerror = reject;
    });

  const runGeneration = useCallback(async (selectedFile: File) => {
    setStage('processing');
    setError(null);
    setGeneratedImageUrl(null);
    setAnalysisText(null);
    setProgressIdx(0);

    try {
      // @ts-ignore
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Key is missing from your pouch.');

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = await fileToBase64(selectedFile);

      setProgressStep('Scrying sketch...');
      setProgressIdx(0);

      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: selectedFile.type, data: base64Data } },
            { text: "You are an expert UI/UX designer. Analyze this hand-drawn wireframe/sketch of a user interface. Describe the layout, the components (buttons, text fields, images, headers, etc.), the structure, and the intended functionality in extreme detail. Your description will be used by an image generation model to create a high-fidelity, modern, clean, and professional UI design. Make sure to specify the placement of elements, the hierarchy, and suggest a modern color palette and typography style that fits the implied purpose of the app." },
          ],
        },
      });

      const analysis = analysisResponse.text;
      if (!analysis) throw new Error('Scrying failed.');
      setAnalysisText(analysis);

      setProgressStep('Forging UI...');
      setProgressIdx(1);

      const generationPrompt = `A high-fidelity, modern, clean, and professional UI design. ${analysis}. The design should look like a finished product screenshot from Dribbble or Behance, with proper spacing, modern typography, and a cohesive color scheme. Do not include any hand-drawn elements, make it look like a real digital product.`;

      const generationResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: generationPrompt }] },
        config: {
          imageConfig: {
            imageSize: '4K',
            aspectRatio: '16:9',
          },
        },
      });

      let imageUrl: string | null = null;
      if (generationResponse.candidates?.[0]?.content?.parts) {
        for (const part of generationResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!imageUrl) throw new Error('Forging failed — no image returned.');

      setGeneratedImageUrl(imageUrl);
      setProgressIdx(2);
      setProgressStep('');
      setStage('ready');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'The Bifrost collapsed. Try again.');
      setStage('idle');
      if (err.message?.includes('Requested entity was not found')) onKeyError();
    }
  }, [onKeyError]);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Only image artifacts accepted by the Allseeing Eye.');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    runGeneration(selectedFile);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setStage('idle');
    setGeneratedImageUrl(null);
    setAnalysisText(null);
    setError(null);
  };

  return (
    <div style={{ minHeight: '100dvh', fontFamily: "'Josefin Sans', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* ── Full-screen looping GIF background ── */}
      {gifBackground}

      {/* ── Floating Header — transparent, above GIF ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        padding: '16px 20px 0',
      }}>
        <div style={{
          width: '100%', maxWidth: 480,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(8,12,15,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '10px 18px',
          border: '1px solid rgba(212,175,55,0.18)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at 35% 35%, rgba(212,175,55,0.25), rgba(8,12,15,0.8))',
              border: '1px solid rgba(212,175,55,0.4)',
              boxShadow: '0 0 10px rgba(212,175,55,0.2)',
            }}>
              <span style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 14 }}>ᚺ</span>
            </div>
            <span style={{ fontFamily: 'Cinzel, serif', color: '#e8cb6a', fontWeight: 700, fontSize: 14, letterSpacing: '0.2em' }}>
              HEIMDALL
            </span>
          </div>
          {/* Badge */}
          <div className="tag-badge">
            <Sparkles style={{ width: 7, height: 7 }} />
            V4
          </div>
        </div>
      </header>

      {/* ── Main Content — centered over GIF ── */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingBottom: 24,
        paddingLeft: 16,
        paddingRight: 16,
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* ── Error Banner ── */}
          {error && (
            <div className="animate-fade-in" style={{
              marginBottom: 16, padding: '12px 16px',
              borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'rgba(220,38,38,0.2)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(220,38,38,0.3)',
            }}>
              <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {/* ═══════════════════════════════
                   IDLE STAGE
              ═══════════════════════════════ */}
          {stage === 'idle' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Hero text — wrapped in a dark scrim for readability */}
              <div style={{
                textAlign: 'center', marginBottom: 8,
                background: 'rgba(5,8,12,0.72)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 20,
                padding: '20px 24px',
                border: '1px solid rgba(212,175,55,0.22)',
              }}>
                <p style={{
                  fontFamily: 'Cinzel, serif', color: '#d4af37',
                  fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  Guardian of the Bifrost
                </p>
                <h1 style={{
                  fontFamily: 'Cinzel, serif', color: '#f5ecd5',
                  fontSize: 28, fontWeight: 700, letterSpacing: '0.08em',
                  textShadow: '0 2px 4px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.15)',
                  margin: 0, marginBottom: 10,
                }}>
                  Forge Your Vision
                </h1>
                <p style={{
                  fontFamily: 'Josefin Sans, sans-serif', color: '#e8e0d0',
                  fontSize: 13, lineHeight: 1.7,
                }}>
                  Cast your sketch into the realm.<br />
                  Heimdall weaves it into code.
                </p>
              </div>

              {/* Upload Zone — glass panel floating over GIF */}
              <div
                className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                style={{
                  background: 'rgba(5,8,12,0.72)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderColor: 'rgba(212,175,55,0.22)',
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <div className="ping-ring" />
                  <div className="ping-ring" style={{ animationDelay: '700ms' }} />
                  <div className="sigil-orb">
                    <Upload style={{ width: 26, height: 26, color: '#d4af37' }} />
                  </div>
                </div>
                <h2 style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 17, letterSpacing: '0.15em', marginBottom: 8 }}>
                  Map the Path
                </h2>
                <p style={{ color: '#e8e0d0', fontSize: 12, lineHeight: 1.6 }}>
                  Drop your wireframe here<br />
                  <span style={{ color: '#a09070', fontSize: 11 }}>PNG · JPG · WEBP</span>
                </p>
                <input type="file" ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept="image/*" style={{ display: 'none' }} />
              </div>

              {/* Feature rows — glass pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="rune-divider" style={{ marginBottom: 4 }}>Our Vow</div>
                {[
                  { icon: Eye, label: 'Instant Vision Analysis', rune: 'ᚢ' },
                  { icon: Zap, label: 'Epic UI Generation', rune: 'ᚱ' },
                  { icon: Bot, label: 'Devstral Code Summoning', rune: 'ᛗ' },
                ].map((item, i) => (
                  <div key={i} className="animate-fade-up" style={{
                    animationDelay: `${i * 80}ms`,
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 14,
                    background: 'rgba(5,8,12,0.72)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(212,175,55,0.22)',
                  }}>
                    <span style={{ fontFamily: 'serif', color: '#d4af37', fontSize: 15, width: 20, textAlign: 'center' }}>
                      {item.rune}
                    </span>
                    <span style={{ fontFamily: 'Josefin Sans, sans-serif', color: '#e8e0d0', fontSize: 12, letterSpacing: '0.04em', fontWeight: 400 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════
                 PROCESSING STAGE
              ═══════════════════════════════ */}
          {stage === 'processing' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Preview with glow blur effect */}
              {previewUrl && (
                <div style={{
                  position: 'relative', borderRadius: 20, overflow: 'hidden',
                  border: '1px solid rgba(212,175,55,0.2)',
                  aspectRatio: '4/3',
                }}>
                  <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) brightness(0.25) contrast(1.3)' }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
                  }}>
                    <div style={{ position: 'relative' }}>
                      <div className="ping-ring" />
                      <div className="ping-ring" style={{ animationDelay: '600ms' }} />
                      <div className="sigil-orb">
                        <Sparkles style={{ width: 24, height: 24, color: '#d4af37', filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.8))' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 14, letterSpacing: '0.15em', marginBottom: 4, textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
                        {progressStep || 'Working…'}
                      </p>
                      <p style={{ color: 'rgba(160,144,112,0.6)', fontSize: 11 }}>The forge is lit…</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps */}
              <div style={{
                borderRadius: 20, overflow: 'hidden',
                background: 'rgba(8,12,15,0.5)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(212,175,55,0.12)',
                padding: 16,
              }}>
                {STEPS.map((step, i) => {
                  const isDone = i < progressIdx;
                  const isActive = i === progressIdx;
                  return (
                    <div key={i} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone || isActive ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isDone || isActive ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                        {isDone
                          ? <CheckCircle style={{ width: 14, height: 14, color: '#d4af37' }} />
                          : isActive
                            ? <Loader2 style={{ width: 14, height: 14, color: '#d4af37', animation: 'spin 1s linear infinite' }} />
                            : <step.icon style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }} />
                        }
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: isDone ? 'rgba(212,175,55,0.5)' : isActive ? '#d4af37' : 'rgba(255,255,255,0.2)', fontWeight: isActive ? 600 : 300 }}>
                          {step.label}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{step.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontFamily: 'Cinzel, serif', color: 'rgba(212,175,55,0.4)', fontSize: 10, letterSpacing: '0.3em', textAlign: 'center', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ
              </p>
            </div>
          )}

          {/* ═══════════════════════════════
                   READY STAGE
              ═══════════════════════════════ */}
          {stage === 'ready' && generatedImageUrl && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                position: 'relative', borderRadius: 20, overflow: 'hidden',
                border: '1px solid rgba(212,175,55,0.3)',
                boxShadow: '0 0 40px rgba(212,175,55,0.12), 0 20px 60px rgba(0,0,0,0.5)',
              }}>
                <img src={generatedImageUrl} style={{ width: '100%', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(8,12,15,0.7) 100%)' }} />
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <span className="tag-badge"><Zap style={{ width: 7, height: 7 }} />Artifact Forged</span>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                  <CheckCircle style={{ width: 14, height: 14, color: '#d4af37' }} />
                  <p style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 13, letterSpacing: '0.12em', textShadow: '0 0 20px rgba(212,175,55,0.4)' }}>
                    Vision Forged
                  </p>
                </div>
                <p style={{ color: 'rgba(160,144,112,0.8)', fontSize: 12, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                  Summon Devstral to forge the code.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setStage('chatting')} className="btn-bifrost">
                  <Bot style={{ width: 16, height: 16 }} />
                  Summon Devstral
                </button>
                <button onClick={handleReset} className="btn-ghost">
                  ᛟ  Discard & Start Over  ᛟ
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════
                 CHATTING STAGE
              ═══════════════════════════════ */}
          {stage === 'chatting' && analysisText && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {generatedImageUrl && (
                <div style={{
                  position: 'relative', borderRadius: 16, overflow: 'hidden', height: 100,
                  border: '1px solid rgba(212,175,55,0.15)',
                }}>
                  <img src={generatedImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,12,15,0.7), transparent)', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                    <div>
                      <p style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Active Artifact</p>
                      <p style={{ color: 'rgba(160,144,112,0.7)', fontSize: 11 }}>Devstral reads your vision</p>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginLeft: -16, marginRight: -16 }}>
                <ChatBox initialAnalysis={analysisText} />
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

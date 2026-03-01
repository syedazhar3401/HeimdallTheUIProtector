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

// ─── Rune symbols for Norse flair ───
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];

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

  if (checkingKey) {
    return (
      <div className="min-h-screen bg-[#080c0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="sigil-orb">
            <span className="text-[#d4af37] text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>ᚺ</span>
          </div>
          <p className="text-[#d4af37]/50 text-xs tracking-[0.3em] uppercase" style={{ fontFamily: 'Cinzel,serif' }}>Awakening…</p>
        </div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-[#080c0f] flex items-center justify-center p-6">
        {/* Background GIF */}
        <img src="/backgrounds/app_background.gif" alt="" aria-hidden="true"
          className="fixed inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: -20 }} />
        <div className="fixed inset-0 bg-[#080c0f]/75 pointer-events-none" style={{ zIndex: -10 }} />

        <div className="glass-card p-8 max-w-sm w-full text-center animate-fade-up">
          {/* Corner decorations */}
          <div className="corner-decoration corner-tl" />
          <div className="corner-decoration corner-tr" />
          <div className="corner-decoration corner-bl" />
          <div className="corner-decoration corner-br" />

          <div className="sigil-orb mx-auto mb-6">
            <Key className="w-6 h-6 text-[#d4af37]" />
          </div>
          <h1 className="rune-font text-[#d4af37] text-2xl mb-2">Entry Required</h1>
          <p className="text-[#a09070] text-sm leading-relaxed mb-6">
            Seeker, present your key to access the Bifrost.{' '}
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer"
              className="text-[#d4af37] hover:text-[#e8cb6a] underline decoration-[#d4af37]/30 underline-offset-4 transition-colors">
              Acquire one from the Allfather.
            </a>
          </p>
          <button onClick={handleSelectKey} className="btn-bifrost">
            <Shield className="w-4 h-4" />
            Present Key
          </button>
        </div>
      </div>
    );
  }

  return <MainApp onKeyError={() => setHasKey(false)} />;
}

type Stage = 'idle' | 'processing' | 'ready' | 'chatting';

function MainApp({ onKeyError }: { onKeyError: () => void }) {
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
    { icon: Zap, label: 'Forging the 4K UI', sub: 'Image generation' },
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
            { text: "You are an expert UI/UX designer. Analyze this hand-drawn wireframe/sketch. Describe it for an image generator. Focus on a high-fidelity, modern, clean, and professional UI design. Suggest a modern color palette and typography style." },
          ],
        },
      });

      const analysis = analysisResponse.text;
      if (!analysis) throw new Error('Scrying failed.');
      setAnalysisText(analysis);

      setProgressStep('Forging 4K UI...');
      setProgressIdx(1);

      const generationPrompt = `A high-fidelity, modern, clean, and professional UI design. ${analysis}. No hand-drawn elements. 4K resolution, 16:9 aspect ratio.`;

      const generationResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: generationPrompt }] },
        config: { responseModalities: ['TEXT', 'IMAGE'] },
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
      setError('Only image artifacts are accepted by the Allseeing Eye.');
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
    <div className="min-h-screen bg-[#080c0f]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>

      {/* ── Looping background GIF ── */}
      <img src="/backgrounds/app_background.gif" alt="" aria-hidden="true"
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: -20 }} />
      {/* Dark overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        zIndex: -10,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.04) 0%, transparent 60%), rgba(8,12,15,0.82)'
      }} />

      {/* ── Floating Header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[420px] px-5 pt-5 pb-3 flex items-center justify-between pointer-events-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center relative"
              style={{
                background: 'radial-gradient(circle at 35% 35%, rgba(212,175,55,0.2), rgba(13,17,23,0.9))',
                border: '1px solid rgba(212,175,55,0.35)',
                boxShadow: '0 0 12px rgba(212,175,55,0.2)'
              }}>
              <span style={{ fontFamily: 'Cinzel,serif', color: '#d4af37', fontSize: 14 }}>ᚺ</span>
            </div>
            <span style={{ fontFamily: 'Cinzel,serif', color: '#d4af37', fontWeight: 700, fontSize: 15, letterSpacing: '0.15em' }}>
              HEIMDALL
            </span>
          </div>
          {/* Badge */}
          <div className="tag-badge">
            <Sparkles style={{ width: 8, height: 8 }} />
            V3.5
          </div>
        </div>
      </header>

      {/* ── Mobile Frame ── */}
      <div className="flex justify-center px-4">
        <div className="mobile-frame">
          {/* Subtle scanline texture */}
          <div className="hud-scanlines" style={{ opacity: 0.4, zIndex: 1 }} />

          {/* Corner decorations on the frame */}
          <div className="corner-decoration corner-tl" />
          <div className="corner-decoration corner-tr" />
          <div className="corner-decoration corner-bl" />
          <div className="corner-decoration corner-br" />

          {/* Scrollable content area */}
          <div className="absolute inset-0 overflow-y-auto no-scrollbar pt-20 pb-6 px-5" style={{ zIndex: 2 }}>

            {/* ── Error Banner ── */}
            {error && (
              <div className="mb-4 p-4 rounded-2xl flex items-start gap-3 animate-fade-in"
                style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {/* ═══════════════════════════════
                     IDLE STAGE
                ═══════════════════════════════ */}
            {stage === 'idle' && (
              <div className="flex flex-col items-center gap-8 animate-fade-up">

                {/* Hero Text */}
                <div className="text-center pt-4">
                  <p className="text-[#d4af37]/50 text-xs tracking-[0.35em] uppercase mb-3"
                    style={{ fontFamily: 'Cinzel,serif' }}>
                    Guardian of the Bifrost
                  </p>
                  <h1 className="text-[#e8e0d0] text-2xl leading-tight mb-2"
                    style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, letterSpacing: '0.1em' }}>
                    Forge Your Vision
                  </h1>
                  <p className="text-[#a09070] text-sm leading-relaxed" style={{ fontFamily: 'Josefin Sans,sans-serif' }}>
                    Cast your sketch into the realm.<br />
                    Heimdall weaves it into code.
                  </p>
                </div>

                {/* Upload Zone */}
                <div
                  className={`upload-zone w-full ${isDragging ? 'dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {/* Pulsing sigil */}
                  <div className="relative mb-6">
                    <div className="ping-ring" style={{ animationDelay: '0ms' }} />
                    <div className="ping-ring" style={{ animationDelay: '700ms' }} />
                    <div className="sigil-orb">
                      <Upload className="w-7 h-7 text-[#d4af37]" />
                    </div>
                  </div>

                  <h2 className="text-[#d4af37] text-lg mb-2" style={{ fontFamily: 'Cinzel,serif', letterSpacing: '0.15em' }}>
                    Map the Path
                  </h2>
                  <p className="text-[#a09070] text-xs leading-relaxed">
                    Drop your wireframe here<br />
                    <span className="text-[#d4af37]/40">PNG · JPG · WEBP</span>
                  </p>
                  <input type="file" ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept="image/*" className="hidden" />
                </div>

                {/* Vow Section */}
                <div className="w-full">
                  <div className="rune-divider mb-5">Our Vow</div>
                  <div className="space-y-3">
                    {[
                      { icon: Eye, label: 'Instant Vision Analysis', rune: 'ᚢ' },
                      { icon: Zap, label: 'Epic 4K UI Generation', rune: 'ᚱ' },
                      { icon: Bot, label: 'Devstral Code Summoning', rune: 'ᛗ' },
                    ].map((item, i) => (
                      <div key={i}
                        className="flex items-center gap-4 p-3 rounded-xl animate-fade-up"
                        style={{
                          animationDelay: `${i * 80}ms`,
                          background: 'rgba(212,175,55,0.04)',
                          border: '1px solid rgba(212,175,55,0.08)'
                        }}>
                        <span className="text-[#d4af37]/40 text-base w-6 text-center" style={{ fontFamily: 'serif' }}>
                          {item.rune}
                        </span>
                        <span className="text-[#a09070] text-xs tracking-wide" style={{ fontFamily: 'Josefin Sans,sans-serif' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ═══════════════════════════════
                   PROCESSING STAGE
                ═══════════════════════════════ */}
            {stage === 'processing' && (
              <div className="flex flex-col items-center gap-6 animate-fade-in">

                {/* Sketch preview with overlay */}
                {previewUrl && (
                  <div className="relative w-full rounded-2xl overflow-hidden"
                    style={{ aspectRatio: '4/3', border: '1px solid rgba(212,175,55,0.15)' }}>
                    <img src={previewUrl} className="w-full h-full object-cover"
                      style={{ filter: 'grayscale(100%) contrast(1.2) brightness(0.3)' }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                      <div className="relative">
                        <div className="ping-ring" />
                        <div className="ping-ring" style={{ animationDelay: '600ms' }} />
                        <div className="sigil-orb">
                          <Sparkles className="w-6 h-6 text-[#d4af37]" style={{ filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.8))' }} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[#d4af37] text-sm mb-1" style={{ fontFamily: 'Cinzel,serif', letterSpacing: '0.15em' }}>
                          {progressStep || 'Working…'}
                        </p>
                        <p className="text-[#a09070]/60 text-xs">The forge is lit…</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress steps */}
                <div className="w-full space-y-2">
                  {STEPS.map((step, i) => {
                    const isDone = i < progressIdx;
                    const isActive = i === progressIdx;
                    return (
                      <div key={i} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: isDone ? 'rgba(212,175,55,0.15)' : isActive ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isDone || isActive ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {isDone
                            ? <CheckCircle className="w-4 h-4 text-[#d4af37]" />
                            : isActive
                              ? <Loader2 className="w-4 h-4 text-[#d4af37] animate-spin" />
                              : <step.icon className="w-3.5 h-3.5 text-white/20" />
                          }
                        </div>
                        <div>
                          <p className="text-xs"
                            style={{
                              fontFamily: 'Josefin Sans,sans-serif',
                              color: isDone ? 'rgba(212,175,55,0.5)' : isActive ? '#d4af37' : 'rgba(255,255,255,0.2)',
                              fontWeight: isActive ? 600 : 300,
                            }}>
                            {step.label}
                          </p>
                          <p className="text-[10px] text-white/20">{step.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[#a09070]/50 text-[10px] tracking-[0.25em] uppercase text-center"
                  style={{ fontFamily: 'Cinzel,serif' }}>
                  ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ
                </p>
              </div>
            )}

            {/* ═══════════════════════════════
                     READY STAGE
                ═══════════════════════════════ */}
            {stage === 'ready' && generatedImageUrl && (
              <div className="flex flex-col gap-6 animate-fade-up">

                {/* Generated artifact */}
                <div className="relative rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(212,175,55,0.25)', boxShadow: '0 0 40px rgba(212,175,55,0.1)' }}>
                  <img src={generatedImageUrl} className="w-full" />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(8,12,15,0.8) 100%)' }} />
                  {/* Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="tag-badge">
                      <Zap style={{ width: 7, height: 7 }} />
                      4K Artifact
                    </span>
                  </div>
                </div>

                {/* Success message */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-[#d4af37]" />
                    <p className="text-[#d4af37] text-sm" style={{ fontFamily: 'Cinzel,serif', letterSpacing: '0.12em' }}>
                      Artifact Forged
                    </p>
                  </div>
                  <p className="text-[#a09070] text-xs">Your vision has taken form. Summon Devstral to forge the code.</p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-3">
                  <button onClick={() => setStage('chatting')} className="btn-bifrost">
                    <Bot className="w-4 h-4" />
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
              <div className="flex flex-col gap-4 animate-fade-in">

                {/* Thumbnail reference */}
                {generatedImageUrl && (
                  <div className="relative rounded-xl overflow-hidden h-28 shrink-0"
                    style={{ border: '1px solid rgba(212,175,55,0.15)' }}>
                    <img src={generatedImageUrl} className="w-full h-full object-cover opacity-40" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(8,12,15,0.6), transparent)' }} />
                    <div className="absolute inset-0 flex items-center px-4">
                      <div>
                        <p className="text-[#d4af37] text-xs mb-0.5" style={{ fontFamily: 'Cinzel,serif', letterSpacing: '0.12em' }}>
                          Active Artifact
                        </p>
                        <p className="text-[#a09070] text-[11px]">Devstral reads your vision</p>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="tag-badge">4K</span>
                    </div>
                  </div>
                )}

                {/* ChatBox */}
                <div className="-mx-5">
                  <ChatBox initialAnalysis={analysisText} />
                </div>

              </div>
            )}

          </div>{/* end scrollable content */}
        </div>{/* end mobile-frame */}
      </div>

    </div>
  );
}

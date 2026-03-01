import React, { useState, useEffect, useRef, DragEvent, ChangeEvent, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Loader2, Sparkles, AlertCircle, LayoutTemplate, Key, Bot, CheckCircle, Shield, Map as MapIcon, Compass } from 'lucide-react';
import ChatBox from './ChatBox';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

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
      <div className="min-h-screen bg-[#05100a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-[#05100a] flex items-center justify-center p-4">
        <div className="bg-[#0d2818]/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-[#d4af37]/20 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#d4af37]/10 text-[#d4af37] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/30 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Key className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-[#d4af37] mb-3 epic-font">Entry Required</h1>
          <p className="text-[#e0d7b8]/80 mb-8 font-serif italic">
            Seeker, you must provide your mystical key to enter the halls of Heimdall.
            <br /><br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[#d4af37] hover:brightness-125 underline decoration-[#d4af37]/30 underline-offset-4">
              Acquire a key from the Elders
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="gold-button w-full"
          >
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
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
        else reject(new Error('Failed to convert file to base64'));
      };
      reader.onerror = reject;
    });

  const runGeneration = useCallback(async (selectedFile: File) => {
    setStage('processing');
    setError(null);
    setGeneratedImageUrl(null);
    setAnalysisText(null);

    try {
      // @ts-ignore
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Key is missing from your pouch.');

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = await fileToBase64(selectedFile);

      setProgressStep('Scrying sketch...');
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
      const generationPrompt = `A high-fidelity, modern, clean, and professional UI design. ${analysis}. No hand-drawn elements.`;

      const generationResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: generationPrompt }] },
        config: { imageConfig: { imageSize: '4K', aspectRatio: '16:9' } },
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

      if (!imageUrl) throw new Error('Forging failed.');

      setGeneratedImageUrl(imageUrl);
      setProgressStep('');
      setStage('ready');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'The magic failed.');
      setStage('idle');
      if (err.message?.includes('Requested entity was not found')) onKeyError();
    }
  }, [onKeyError]);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Only visual artifacts are accepted.');
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
    <div className="min-h-screen bg-[#05100a] text-[#e0d7b8] font-serif selection:bg-[#d4af37]/30 selection:text-[#d4af37]">
      <div className="adventure-bg" />

      {/* Header (Floating Adventure Style) */}
      <header className="fixed top-0 left-0 right-0 z-30 px-6 py-4 pointer-events-none">
        <div className="max-w-[480px] mx-auto flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0d2818] border border-[#d4af37]/40 rounded-full flex items-center justify-center shadow-lg shadow-black/50 overflow-hidden">
              <Shield className="w-5 h-5 text-[#d4af37]" />
            </div>
            <span className="text-xl font-bold epic-font text-[#d4af37] drop-shadow-md">Heimdall</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] epic-font text-[#d4af37]/60 tracking-[0.2em] uppercase">
            <Sparkles className="w-3 h-3" />
            V3 Edition
          </div>
        </div>
      </header>

      <main className="pt-20 pb-10">
        <div className="mobile-frame-container overflow-y-auto no-scrollbar relative">

          <div className="p-6 min-h-full">
            {error && (
              <div className="mb-6 p-4 bg-red-900/40 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-xs">{error}</p>
              </div>
            )}

            {/* === IDLE === */}
            {stage === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center animate-in fade-in zoom-in duration-500">
                <div
                  className={`relative w-full border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer group active:scale-95
                    ${isDragging ? 'border-[#d4af37] bg-[#d4af37]/10' : 'border-[#d4af37]/20 hover:border-[#d4af37]/40 bg-[#0d2818]/20'}
                  `}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-24 h-24 bg-[#0d2818] border border-[#d4af37]/40 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl relative">
                    <div className="absolute inset-0 bg-[#d4af37]/10 animate-pulse rounded-full" />
                    <Upload className="w-10 h-10 text-[#d4af37]" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#d4af37] mb-4 epic-font">Map the Path</h2>
                  <p className="text-[#e0d7b8]/60 text-sm italic font-serif leading-relaxed">
                    Cast your sketch into the forest.<br />We will weave your vision into reality.
                  </p>
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} accept="image/*" className="hidden" />
                </div>

                <div className="mt-12 flex flex-col gap-6 w-full max-w-[280px]">
                  <div className="flex items-center gap-4 text-[#d4af37]/40 text-xs tracking-widest uppercase italic">
                    <div className="h-[1px] flex-1 bg-[#d4af37]/20" />
                    Our Vow
                    <div className="h-[1px] flex-1 bg-[#d4af37]/20" />
                  </div>
                  <div className="space-y-4">
                    {[
                      { icon: MapIcon, text: "Instant Scrying (Analysis)" },
                      { icon: Compass, text: "Epic 4K Forging (UI)" },
                      { icon: Bot, text: "Devstral Code Magic" }
                    ].map((vow, i) => (
                      <div key={i} className="flex items-center gap-3 text-left">
                        <vow.icon className="w-4 h-4 text-[#d4af37]/60" />
                        <span className="text-[11px] text-[#e0d7b8]/40 tracking-wide font-serif">{vow.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === PROCESSING === */}
            {stage === 'processing' && (
              <div className="flex flex-col items-center justify-center h-full py-12 animate-in fade-in duration-700">
                <div className="w-full relative rounded-3xl overflow-hidden border border-[#d4af37]/20 bg-[#0d2818]/40 aspect-[9/16] flex items-center justify-center">
                  {previewUrl && <img src={previewUrl} className="w-full h-full object-cover opacity-20 filter grayscale contrast-150" />}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border border-[#d4af37]/20 absolute inset-0 animate-ping" />
                      <div className="w-24 h-24 rounded-full border border-[#d4af37]/10 absolute inset-0 animate-ping delay-500" />
                      <div className="w-24 h-24 bg-[#0d2818]/60 backdrop-blur-xl border border-[#d4af37]/40 rounded-full flex items-center justify-center relative shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                        <Sparkles className="w-10 h-10 text-[#d4af37] animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center px-6">
                      <h3 className="text-[#d4af37] epic-font text-xl mb-2">{progressStep}</h3>
                      <p className="text-[#e0d7b8]/40 text-xs italic font-serif">The spirits are weaving your 4K tapestry…</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === READY === */}
            {stage === 'ready' && generatedImageUrl && (
              <div className="flex flex-col items-center gap-10 animate-in slide-in-from-bottom-10 duration-700 h-full">
                <div className="w-full rounded-2xl overflow-hidden border border-[#d4af37]/30 shadow-2xl relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05100a] via-transparent to-transparent z-10 opacity-60" />
                  <img src={generatedImageUrl} className="w-full object-contain" />
                  <div className="absolute bottom-4 left-4 z-20">
                    <span className="bg-[#d4af37] text-[#05100a] text-[10px] font-bold px-2 py-0.5 rounded epic-font">4K Artifact</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6 w-full mt-auto mb-12">
                  <button
                    onClick={() => setStage('chatting')}
                    className="gold-button w-full text-lg epic-font"
                  >
                    Summon Devstral
                  </button>
                  <button onClick={handleReset} className="text-[10px] tracking-widest uppercase text-[#d4af37]/40 hover:text-[#d4af37] transition-colors epic-font">
                    Discard Artifact
                  </button>
                </div>
              </div>
            )}

            {/* === CHATTING === */}
            {stage === 'chatting' && analysisText && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500 h-full">
                {generatedImageUrl && (
                  <div className="w-full rounded-2xl overflow-hidden border border-[#d4af37]/20 relative">
                    <img src={generatedImageUrl} className="w-full h-40 object-cover opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05100a] to-transparent" />
                  </div>
                )}
                <div className="flex-1 -mx-6 h-full"> {/* Overflow compensation for chatbox padding */}
                  <ChatBox initialAnalysis={analysisText} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef, DragEvent, ChangeEvent, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Loader2, Sparkles, AlertCircle, LayoutTemplate, Key, Bot, CheckCircle } from 'lucide-react';
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl border border-zinc-800 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-5">
            <Key className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">API Key Required</h1>
          <p className="text-zinc-400 mb-6">
            To use HeimdallSketch, you need to select a paid Google Cloud API key.
            <br /><br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              Learn more about billing
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            Select API Key
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
      if (!apiKey) throw new Error('API key is missing. Please select an API key.');

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = await fileToBase64(selectedFile);

      // Step 1: Analyze the sketch
      setProgressStep('Analyzing sketch...');
      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: selectedFile.type,
                data: base64Data,
              },
            },
            {
              text: "You are an expert UI/UX designer. Analyze this hand-drawn wireframe/sketch of a user interface. Describe the layout, the components (buttons, text fields, images, headers, etc.), the structure, and the intended functionality in extreme detail. Your description will be used by an image generation model to create a high-fidelity, modern, clean, and professional UI design. Make sure to specify the placement of elements, the hierarchy, and suggest a modern color palette and typography style that fits the implied purpose of the app.",
            },
          ],
        },
      });

      const analysis = analysisResponse.text;
      if (!analysis) throw new Error('Failed to analyze the image.');
      setAnalysisText(analysis);

      // Step 2: Generate the high-fidelity UI (always 4K)
      setProgressStep('Designing UI in 4K...');
      const generationPrompt = `A high-fidelity, modern, clean, and professional UI design. ${analysis}. The design should look like a finished product screenshot from Dribbble or Behance, with proper spacing, modern typography, and a cohesive color scheme. Do not include any hand-drawn elements, make it look like a real digital product.`;

      const generationResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: generationPrompt }],
        },
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

      if (!imageUrl) throw new Error('Failed to generate image. No image data returned.');

      setGeneratedImageUrl(imageUrl);
      setProgressStep('');
      setStage('ready');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during generation.');
      setStage('idle');
      if (err.message?.includes('Requested entity was not found')) {
        onKeyError();
      }
    }
  }, [onKeyError]);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    runGeneration(selectedFile);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
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
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/80 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <LayoutTemplate className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight">HeimdallSketch</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Powered by Gemini &amp; Devstral 2
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Error Banner */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* === IDLE: Upload only === */}
        {stage === 'idle' && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className={`relative w-full max-w-lg border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group
                ${isDragging
                  ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
                  : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/60'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:border-indigo-500/50 transition-colors">
                <Upload className="w-9 h-9 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-xl font-semibold text-white mb-2">Drop your sketch here</p>
              <p className="text-zinc-500 text-sm">or click to browse — we'll handle the rest instantly</p>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
            <p className="text-zinc-600 text-xs mt-6">
              Upload any wireframe or sketch &rarr; AI analysis &rarr; 4K UI &rarr; Full code by Devstral 2
            </p>
          </div>
        )}

        {/* === PROCESSING: Background work, show sketch + spinner === */}
        {stage === 'processing' && (
          <div className="flex flex-col items-center gap-8">
            <div className="w-full max-w-2xl relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video flex items-center justify-center">
              {previewUrl && (
                <img src={previewUrl} alt="Uploaded sketch" className="w-full h-full object-contain opacity-30" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                {/* Animated rings */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-indigo-500/30 absolute inset-0 animate-ping" />
                  <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 absolute inset-0 animate-ping" style={{ animationDelay: '0.3s' }} />
                  <div className="w-20 h-20 bg-zinc-900/80 rounded-full flex items-center justify-center relative">
                    <Sparkles className="w-9 h-9 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-lg">{progressStep}</p>
                  <p className="text-zinc-500 text-sm mt-1">Generating your 4K UI in the background…</p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-6 text-sm">
              {[
                { label: 'AI Analysis', done: !!analysisText },
                { label: '4K UI Design', done: !!generatedImageUrl },
                { label: 'Ready for Code', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  {step.done
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  }
                  <span className={step.done ? 'text-zinc-300' : 'text-zinc-500'}>{step.label}</span>
                  {i < 2 && <span className="text-zinc-700 ml-4">—</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === READY: Show generated UI + CTA === */}
        {stage === 'ready' && generatedImageUrl && (
          <div className="flex flex-col items-center gap-8">
            <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-black/50">
              <img src={generatedImageUrl} alt="Generated 4K UI" className="w-full object-contain" />
            </div>

            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <button
                onClick={() => setStage('chatting')}
                className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] text-base"
              >
                <Bot className="w-5 h-5 text-indigo-200" />
                Generate Code with Devstral 2
              </button>
              <button
                onClick={handleReset}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Upload a different sketch
              </button>
            </div>
          </div>
        )}

        {/* === CHATTING: Devstral 2 code generation === */}
        {stage === 'chatting' && analysisText && (
          <div className="flex flex-col gap-6">
            {generatedImageUrl && (
              <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 max-h-64 flex items-center justify-center bg-zinc-900">
                <img src={generatedImageUrl} alt="4K UI reference" className="h-64 object-contain" />
              </div>
            )}
            <ChatBox initialAnalysis={analysisText} />
          </div>
        )}
      </main>
    </div>
  );
}

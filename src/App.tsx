import React, { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Image as ImageIcon, Loader2, Sparkles, AlertCircle, LayoutTemplate, Key, Bot } from 'lucide-react';
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
        // Fallback if not in AI Studio environment
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
        // Assume success to mitigate race condition
        setHasKey(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (checkingKey) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 mb-2">API Key Required</h1>
          <p className="text-zinc-600 mb-6">
            To use the Nano Banana Pro image generation model, you need to select a paid Google Cloud API key.
            <br /><br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              Learn more about billing
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return <MainApp onKeyError={() => setHasKey(false)} />;
}

function MainApp({ onKeyError }: { onKeyError: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [showChatBox, setShowChatBox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    setGeneratedImageUrl(null);
    setAnalysisText(null);
    setShowChatBox(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!file) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImageUrl(null);
    setAnalysisText(null);
    setShowChatBox(false);

    try {
      // @ts-ignore - API_KEY is injected at runtime
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API key is missing. Please select an API key.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = await fileToBase64(file);

      // Step 1: Analyze the sketch
      setProgressStep('Analyzing sketch...');
      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data
              }
            },
            {
              text: "You are an expert UI/UX designer. Analyze this hand-drawn wireframe/sketch of a user interface. Describe the layout, the components (buttons, text fields, images, headers, etc.), the structure, and the intended functionality in extreme detail. Your description will be used by an image generation model to create a high-fidelity, modern, clean, and professional UI design. Make sure to specify the placement of elements, the hierarchy, and suggest a modern color palette and typography style that fits the implied purpose of the app."
            }
          ]
        }
      });

      const analysis = analysisResponse.text;
      if (!analysis) {
        throw new Error("Failed to analyze the image.");
      }
      setAnalysisText(analysis);

      // Step 2: Generate the UI
      setProgressStep('Generating high-fidelity UI...');
      const generationPrompt = `A high-fidelity, modern, clean, and professional UI design. ${analysis}. The design should look like a finished product screenshot from Dribbble or Behance, with proper spacing, modern typography, and a cohesive color scheme. Do not include any hand-drawn elements, make it look like a real digital product.`;

      const generationResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            { text: generationPrompt }
          ]
        },
        config: {
          imageConfig: {
            imageSize: imageSize,
            aspectRatio: "16:9"
          }
        }
      });

      let imageUrl = null;
      if (generationResponse.candidates && generationResponse.candidates[0]?.content?.parts) {
        for (const part of generationResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!imageUrl) {
        throw new Error("Failed to generate image. No image data returned.");
      }

      setGeneratedImageUrl(imageUrl);
      setProgressStep('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during generation.');
      if (err.message?.includes('Requested entity was not found')) {
        onKeyError();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Sketch to UI</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Powered by Gemini 3.1 Pro & Nano Banana Pro
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Input */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">1</span>
                Upload Sketch
              </h2>

              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50'
                  } ${previewUrl ? 'border-none p-0 bg-transparent overflow-hidden' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {previewUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-square flex items-center justify-center">
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-zinc-900 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-zinc-50 transition-colors"
                      >
                        Change Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-zinc-700 font-medium mb-1">Drag and drop your sketch</p>
                    <p className="text-zinc-500 text-sm mb-4">or click to browse files</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-zinc-50 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">2</span>
                Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Output Resolution
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['1K', '2K', '4K'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${imageSize === size
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                          }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Higher resolutions take longer to generate. 4K is recommended for final exports.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleGenerate}
                  disabled={!file || isGenerating}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-medium text-white transition-all ${!file || isGenerating
                      ? 'bg-zinc-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {progressStep}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate UI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 h-full flex flex-col">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">3</span>
                Result
              </h2>

              <div className="flex-1 bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden flex flex-col items-center justify-center relative min-h-[400px]">
                {generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt="Generated UI"
                    className="w-full h-full object-contain"
                  />
                ) : isGenerating ? (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-indigo-50 animate-pulse" />
                      <Sparkles className="w-8 h-8 text-indigo-500 relative z-10 animate-bounce" />
                    </div>
                    <p className="text-zinc-600 font-medium animate-pulse">{progressStep}</p>
                    <p className="text-zinc-400 text-sm mt-2">This may take a minute...</p>
                  </div>
                ) : (
                  <div className="text-center p-8 text-zinc-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Your generated UI will appear here</p>
                  </div>
                )}
              </div>

              {analysisText && !showChatBox && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-zinc-900 mb-2">AI Analysis</h3>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-sm text-zinc-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {analysisText}
                  </div>
                  <button
                    onClick={() => setShowChatBox(true)}
                    className="w-full mt-4 bg-zinc-900 hover:bg-black text-white py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Bot className="w-5 h-5 text-indigo-400" />
                    Generate Code with Devstral 2
                  </button>
                </div>
              )}

              {showChatBox && analysisText && (
                <ChatBox initialAnalysis={analysisText} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

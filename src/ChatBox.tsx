import React, { useState, useEffect, useRef } from 'react';
import { Send, Download, Loader2, Bot, User } from 'lucide-react';
import JSZip from 'jszip';

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatBoxProps {
    initialAnalysis: string;
}

export default function ChatBox({ initialAnalysis }: ChatBoxProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const systemPrompt = `You are a world-class expert software engineer and UI/UX designer. Your name is Devstral.
You have been given a detailed UI analysis of a sketch. Your task is to write a complete, functional, and visually stunning web application based on this analysis and user instructions.

ANALYSIS OF THE UI:
${initialAnalysis}

INSTRUCTIONS:
1. First, warmly greet the user/seeker and ask them what type of app they want to build (e.g., React with Vite, plain HTML/CSS/JS, Next.js). Mention the quest/analysis you received.
2. Wait for their response.
3. Once they confirm the stack, generate the full code for the application.
4. DESIGN AESTHETICS (CRITICAL): The user must be WOWED at first glance. You MUST use best practices in modern web design (e.g., vibrant colors, sleek dark modes, glassmorphism, smooth gradients, and micro-animations) to create a premium, state-of-the-art interface. Avoid generic colors; use curated, harmonious palettes. Use modern typography. Add hover effects and interactive elements. Do NOT generate a basic or plain UI. Use Tailwind CSS heavily for styling.
5. IMPORTANT: Always use markdown code blocks with the exact filename explicitly on the line right before the block, like this:
**src/App.tsx**
\`\`\`tsx
...code...
\`\`\`
This exact format with the bold **filename** is required so the file parser can extract the code. Do not forget the bold asterisks!
`;

        const initialMessages: Message[] = [{ role: 'system', content: systemPrompt }];
        setMessages(initialMessages);

        const fetchGreeting = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/mistral/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'devstral-2512',
                        messages: initialMessages,
                        temperature: 0.7
                    })
                });
                const data = await response.json();
                if (data.choices && data.choices[0]) {
                    setMessages(prev => [...prev, data.choices[0].message]);
                } else if (data.error) {
                    console.error("Mistral API Error:", data.error);
                    setMessages(prev => [...prev, { role: 'assistant', content: 'The mystical connection to Mistral has faltered. Ensure your key is valid.' }]);
                }
            } catch (e) {
                console.error("Error fetching initial greeting:", e);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Greetings, Seeker! I am Devstral, ready to forge your vision into code. What tech stack shall we use for this quest?' }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGreeting();
    }, [initialAnalysis]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/mistral/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'devstral-2512',
                    messages: newMessages,
                    temperature: 0.7
                })
            });
            const data = await response.json();
            if (data.choices && data.choices[0]) {
                setMessages([...newMessages, data.choices[0].message]);
            } else if (data.error) {
                console.error("Mistral API Error:", data.error);
                setMessages([...newMessages, { role: 'assistant', content: `Error: ${data.error.message || 'The magic failed.'}` }]);
            }
        } catch (e) {
            console.error(e);
            setMessages([...newMessages, { role: 'assistant', content: 'The connection to the arcane was severed mid-spell.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        const zip = new JSZip();
        let hasFiles = false;
        const codeBlockRegex = /\*\*(.+?)\*\*\s*```\w*\n([\s\S]*?)```/gi;
        const allContent = messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
        let match;
        while ((match = codeBlockRegex.exec(allContent)) !== null) {
            const filePath = match[1].trim();
            const code = match[2].trim();
            zip.file(filePath, code);
            hasFiles = true;
        }
        const fallbackRegex = /`(.+?)`\s*```\w*\n([\s\S]*?)```/gi;
        if (!hasFiles) {
            while ((match = fallbackRegex.exec(allContent)) !== null) {
                const filePath = match[1].trim();
                const code = match[2].trim();
                zip.file(filePath, code);
                hasFiles = true;
            }
        }
        if (hasFiles) {
            // Use base64 data URL — avoids blob URL naming issues in Chrome/Vite contexts
            const base64 = await zip.generateAsync({ type: 'base64' });
            const a = document.createElement('a');
            a.href = `data:application/zip;base64,${base64}`;
            a.download = 'heimdall-artifact.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("No artifacts found to materialize. Ask Devstral to forge the files first.");
        }
    };

    return (
        <div className="flex flex-col chatbot-font" style={{
            height: 560,
            borderTop: '1px solid rgba(212,175,55,0.15)',
            background: 'rgba(8,12,15,0.95)',
            backdropFilter: 'blur(20px)',
        }}>
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3" style={{
                borderBottom: '1px solid rgba(212,175,55,0.12)',
                background: 'rgba(13,17,23,0.7)'
            }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{
                        background: 'rgba(212,175,55,0.12)',
                        border: '1px solid rgba(212,175,55,0.25)'
                    }}>
                        <Bot className="w-4 h-4" style={{ color: '#d4af37' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: '#d4af37' }}>
                            Devstral Agent
                        </p>
                        <p className="text-[9px]" style={{ color: 'rgba(160,144,112,0.6)' }}>Mistral AI · Codegen</p>
                    </div>
                </div>
                <button onClick={handleDownloadZip}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #d4af37, #b89130)', color: '#080c0f' }}>
                    <Download className="w-3 h-3" />
                    Materialize
                </button>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.filter(m => m.role !== 'system').map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{
                            background: msg.role === 'user' ? 'rgba(212,175,55,0.15)' : 'rgba(22,27,34,0.8)',
                            border: '1px solid rgba(212,175,55,0.2)',
                        }}>
                            {msg.role === 'user'
                                ? <User className="w-4 h-4" style={{ color: '#d4af37' }} />
                                : <Bot className="w-4 h-4" style={{ color: '#d4af37' }} />
                            }
                        </div>
                        <div className="max-w-[82%] px-4 py-3 text-[13px] leading-relaxed" style={{
                            borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, #d4af37, #b89130)'
                                : 'rgba(22,27,34,0.85)',
                            border: msg.role === 'user' ? 'none' : '1px solid rgba(212,175,55,0.1)',
                            color: msg.role === 'user' ? '#080c0f' : 'rgba(232,224,208,0.9)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{
                            background: 'rgba(22,27,34,0.8)',
                            border: '1px solid rgba(212,175,55,0.2)'
                        }}>
                            <Bot className="w-4 h-4" style={{ color: '#d4af37' }} />
                        </div>
                        <div className="px-4 py-3 text-xs flex items-center gap-2 italic" style={{
                            borderRadius: '4px 18px 18px 18px',
                            background: 'rgba(22,27,34,0.85)',
                            border: '1px solid rgba(212,175,55,0.1)',
                            color: 'rgba(160,144,112,0.7)',
                        }}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#d4af37' }} />
                            Consulting the archives…
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div className="p-3" style={{ borderTop: '1px solid rgba(212,175,55,0.1)', background: 'rgba(8,12,15,0.9)' }}>
                <div className="relative flex items-center">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                        placeholder="Instruct Devstral…"
                        className="w-full pl-5 pr-12 py-3 text-sm rounded-2xl outline-none transition-all"
                        style={{
                            background: 'rgba(22,27,34,0.7)',
                            border: '1px solid rgba(212,175,55,0.15)',
                            color: 'rgba(232,224,208,0.9)',
                            fontFamily: 'inherit',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(212,175,55,0.4)'; e.target.style.boxShadow = '0 0 12px rgba(212,175,55,0.1)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(212,175,55,0.15)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || isLoading}
                        className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 hover:scale-110 active:scale-95"
                        style={{ background: 'rgba(212,175,55,0.12)', color: '#d4af37' }}>
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

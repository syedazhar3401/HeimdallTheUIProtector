import React, { useState, useEffect, useRef } from 'react';
import { Send, Download, Loader2, Bot, User } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, 'heimdall-artifact.zip');
        } else {
            alert("No artifacts found to materialize. Ask Devstral to forge the files first.");
        }
    };

    return (
        <div className="flex flex-col h-[600px] border border-[#d4af37]/20 rounded-t-3xl bg-[#05100a]/80 backdrop-blur-2xl shadow-2xl overflow-hidden chatbot-font">
            <div className="flex items-center justify-between px-6 py-4 bg-[#0d2818]/60 border-b border-[#d4af37]/20">
                <div className="flex items-center gap-3 text-[#d4af37] font-semibold epic-font uppercase tracking-widest text-xs">
                    <Bot className="w-5 h-5 text-[#d4af37]" />
                    Devstral Agent
                </div>
                <button
                    onClick={handleDownloadZip}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-[#05100a] bg-[#d4af37] rounded-lg hover:scale-105 active:scale-95 transition-all epic-font uppercase tracking-tight"
                >
                    <Download className="w-4 h-4" />
                    Materialize
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {messages.filter(m => m.role !== 'system').map((msg, i) => (
                    <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-full border border-[#d4af37]/20 flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'bg-[#0d2818] text-[#d4af37]'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-[#d4af37] text-[#05100a] font-medium rounded-tr-none' : 'bg-[#0d2818]/80 border border-[#d4af37]/20 text-[#e0d7b8] rounded-tl-none'}`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#0d2818] border border-[#d4af37]/20 flex items-center justify-center shrink-0 text-[#d4af37]">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-[#0d2818]/60 border border-[#d4af37]/10 shadow-sm rounded-2xl rounded-tl-none px-5 py-4 text-sm text-[#e0d7b8]/60 flex items-center gap-3 italic">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Consulting the archives…
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-[#05100a]">
                <div className="relative flex items-center">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Instruct Devstral..."
                        className="w-full pl-6 pr-14 py-4 bg-[#0d2818]/40 border border-[#d4af37]/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37]/40 transition-all text-[#e0d7b8] placeholder:text-[#e0d7b8]/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-3 p-3 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-xl disabled:opacity-30 transition-all"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

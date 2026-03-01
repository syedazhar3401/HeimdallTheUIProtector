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
1. First, warmly greet the user and ask them what type of app they want to build (e.g., React with Vite, plain HTML/CSS/JS, Next.js). Mention the analysis you received.
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
                    setMessages(prev => [...prev, { role: 'assistant', content: 'There was an error connecting to Mistral. Please ensure the API key is correct.' }]);
                }
            } catch (e) {
                console.error("Error fetching initial greeting:", e);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Hello! I am ready to help you build the app based on your sketch. What tech stack would you like to use? (e.g., React, Plain HTML/JS)' }]);
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
                setMessages([...newMessages, { role: 'assistant', content: `Error: ${data.error.message || 'API request failed'}` }]);
            }
        } catch (e) {
            console.error(e);
            setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error communicating with the API.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        const zip = new JSZip();
        let hasFiles = false;

        // A regex to find "**filename**\n```lang\ncode\n```" or similar
        const codeBlockRegex = /\*\*(.+?)\*\*\s*```\w*\n([\s\S]*?)```/gi;

        const allContent = messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
        let match;
        while ((match = codeBlockRegex.exec(allContent)) !== null) {
            const filePath = match[1].trim();
            const code = match[2].trim();
            zip.file(filePath, code);
            hasFiles = true;
        }

        // fallback regex if they used `filename` instead of **filename**
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
            saveAs(blob, 'generated-app.zip');
        } else {
            alert("No code blocks found to download. Please ask the agent to generate the files first.");
        }
    };

    return (
        <div className="flex flex-col h-[500px] border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden mt-6">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                <div className="flex items-center gap-2 text-zinc-800 font-medium">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    Devstral App Generator
                </div>
                <button
                    onClick={handleDownloadZip}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                >
                    <Download className="w-4 h-4" />
                    Download App
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50">
                {messages.filter(m => m.role !== 'system').map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-200 text-zinc-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm'}`}>
                            <div className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-500 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-zinc-200">
                <div className="relative flex items-center text-sm">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Tell Devstral what to build..."
                        className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:hover:text-zinc-400 disabled:hover:bg-transparent transition"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import {
  CanonicalSchema
} from '../types/schema';
import {
  callGeminiAnalyzeImage,
  callGeminiHighThinking,
  callGeminiAnalyzeVideo,
  callGeminiFastResponse,
  callGeminiSearchGrounding
} from '../services/geminiService';
import {
  Sparkles,
  Brain,
  Image as ImageIcon,
  Video,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Send,
  UploadCloud,
  FileCode
} from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: CanonicalSchema;
  onLoadGeneratedSql?: (sql: string) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  schema,
  onLoadGeneratedSql
}) => {
  const [activeMode, setActiveMode] = useState<'image' | 'thinking' | 'video' | 'fast' | 'search'>('thinking');

  // Input states
  const [promptInput, setPromptInput] = useState('');
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileMime, setFileMime] = useState<string>('');

  // Result states
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string>('');
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileMime(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAi = async () => {
    setLoading(true);
    setResponseOutput('');
    setSources([]);

    try {
      if (activeMode === 'image') {
        if (!fileBase64) throw new Error('Please select an ERD / diagram image first.');
        const res = await callGeminiAnalyzeImage(
          fileBase64,
          fileMime || 'image/png',
          promptInput || 'Analyze this ERD diagram and extract complete SQL CREATE TABLE statements.'
        );
        setResponseOutput(res.text);
      } else if (activeMode === 'thinking') {
        const res = await callGeminiHighThinking(
          schema,
          promptInput || 'Analyze this schema for circular dependencies, normalization violations, and missing composite indexes.'
        );
        setResponseOutput(res.text);
      } else if (activeMode === 'video') {
        if (!fileBase64) throw new Error('Please upload a video file first.');
        const res = await callGeminiAnalyzeVideo(
          fileBase64,
          fileMime || 'video/mp4',
          promptInput || 'Extract all database architecture decisions and entities discussed in this video.'
        );
        setResponseOutput(res.text);
      } else if (activeMode === 'fast') {
        const res = await callGeminiFastResponse(
          promptInput || 'Give me quick optimization advice for these foreign keys.',
          schema.tables[0]
        );
        setResponseOutput(res.text);
      } else if (activeMode === 'search') {
        const res = await callGeminiSearchGrounding(
          promptInput || 'What are the newest migration features in Laravel 13 and MySQL 8.4 generated columns?'
        );
        setResponseOutput(res.text);
        if (res.sources) setSources(res.sources);
      }
    } catch (err: any) {
      setResponseOutput(`Error: ${err.message || 'AI request failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(responseOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div
        id="ai-assistant-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                Gemini AI Database Architect
              </h3>
              <p className="text-xs text-slate-400">
                Powered by Gemini 3.1 Pro Preview, High Thinking, Fast Lite, and Search Grounding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => {
              setActiveMode('thinking');
              setPromptInput('');
              setFileBase64(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeMode === 'thinking'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4 text-cyan-400" />
            High Thinking Mode
          </button>

          <button
            onClick={() => {
              setActiveMode('image');
              setPromptInput('');
              setFileBase64(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeMode === 'image'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-purple-400" />
            Analyze ERD Image
          </button>

          <button
            onClick={() => {
              setActiveMode('video');
              setPromptInput('');
              setFileBase64(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeMode === 'video'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4 text-emerald-400" />
            Analyze Video Content
          </button>

          <button
            onClick={() => {
              setActiveMode('fast');
              setPromptInput('');
              setFileBase64(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeMode === 'fast'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Low-Latency Quick Q&A
          </button>

          <button
            onClick={() => {
              setActiveMode('search');
              setPromptInput('');
              setFileBase64(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeMode === 'search'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-blue-400" />
            Google Search Grounding
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* File Upload for Image or Video */}
          {(activeMode === 'image' || activeMode === 'video') && (
            <div className="border border-dashed border-slate-700 rounded-xl p-4 bg-slate-950/40 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {activeMode === 'image' ? 'Upload ERD diagram or whiteboard photo' : 'Upload walkthrough or database demo video'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {fileName ? `Selected: ${fileName}` : activeMode === 'image' ? 'Supports PNG, JPEG, WEBP' : 'Supports MP4, WEBM, MOV'}
                </p>
              </div>
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shrink-0">
                <UploadCloud className="w-4 h-4" />
                <span>{fileName ? 'Change File' : 'Browse File'}</span>
                <input
                  type="file"
                  accept={activeMode === 'image' ? 'image/*' : 'video/*'}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Prompt Input Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Instruction or Question</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeMode === 'thinking' && 'Gemini 3.1 Pro (Thinking Level: High)'}
                {activeMode === 'image' && 'Gemini 3.1 Pro Preview (Vision)'}
                {activeMode === 'video' && 'Gemini 3.1 Pro Preview (Multimodal Video)'}
                {activeMode === 'fast' && 'Gemini 3.1 Flash Lite (Low-Latency)'}
                {activeMode === 'search' && 'Gemini 3.5 Flash + Google Search Grounding'}
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleRunAi()}
                placeholder={
                  activeMode === 'thinking'
                    ? 'e.g., Audit schema for circular dependencies and propose a 2-phase migration strategy.'
                    : activeMode === 'image'
                    ? 'e.g., Extract all tables and relationships into standard SQL DDL statements.'
                    : activeMode === 'video'
                    ? 'e.g., Summarize all database tables and business constraints mentioned in the video.'
                    : activeMode === 'fast'
                    ? 'e.g., Should I use BIGINT or UUID for the tenant_id column?'
                    : 'e.g., What are the best practices for Laravel 13 composite indexes and MySQL 8.4?'
                }
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
              <button
                onClick={handleRunAi}
                disabled={loading}
                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Run AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Response Output Box */}
          {responseOutput && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gemini Architect Output
                </span>
                <div className="flex items-center gap-2">
                  {onLoadGeneratedSql && responseOutput.includes('CREATE TABLE') && (
                    <button
                      onClick={() => onLoadGeneratedSql(responseOutput)}
                      className="px-2.5 py-1 text-xs bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 rounded font-medium transition flex items-center gap-1"
                    >
                      <FileCode className="w-3 h-3" />
                      Load SQL into SchemaForge
                    </button>
                  )}
                  <button
                    onClick={handleCopy}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs rounded transition flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed select-text">
                {responseOutput}
              </div>

              {/* Grounding Sources */}
              {sources.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-[11px] font-bold text-slate-400 mb-1">
                    Google Search Grounding Sources:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded hover:underline truncate max-w-xs"
                      >
                        {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

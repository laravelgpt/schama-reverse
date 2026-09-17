import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { CanonicalSchema } from '../types/schema';
import {
  Layers,
  Upload,
  Sparkles,
  FolderArchive,
  Download,
  Share2,
  FileCode,
  Activity,
  Network,
  Database,
  User as UserIcon,
  LogIn,
  ChevronDown,
  Globe,
  Printer,
  FileText,
  Table,
  Menu,
  X
} from 'lucide-react';

interface HeaderProps {
  schema: CanonicalSchema;
  activeView: 'erd' | 'explorer' | 'diagnostics' | 'code';
  onViewChange: (view: 'erd' | 'explorer' | 'diagnostics' | 'code') => void;
  onOpenUpload: () => void;
  onOpenAi: () => void;
  onOpenWorkspace: () => void;
  onOpenExport: () => void;
  onDownloadZip: () => void;
  currentUser: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  schema,
  activeView,
  onViewChange,
  onOpenUpload,
  onOpenAi,
  onOpenWorkspace,
  onOpenExport,
  onDownloadZip,
  currentUser
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Top Row on Mobile: Brand & Mobile Action Buttons */}
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Engine Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-100 text-sm sm:text-base tracking-tight font-mono">
                  SchemaForge
                </span>
                <span className="text-[10px] font-mono font-bold uppercase bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 px-2 py-0.5 rounded-full">
                  {schema.database.engine}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
                Reverse Engineering & Universal Code Generator
              </p>
            </div>
          </div>

          {/* Mobile Right: Quick Export & Hamburger */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={onOpenExport}
              className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center: Responsive View Switcher Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto scrollbar-none w-full md:w-auto justify-start sm:justify-center">
          <button
            onClick={() => onViewChange('erd')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 ${
              activeView === 'erd'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>ERD Diagram</span>
          </button>

          <button
            onClick={() => onViewChange('explorer')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 ${
              activeView === 'explorer'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Explorer</span>
          </button>

          <button
            onClick={() => onViewChange('diagnostics')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 ${
              activeView === 'diagnostics'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Diagnostics ({schema.health.overallScore}%)</span>
          </button>

          <button
            onClick={() => onViewChange('code')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 ${
              activeView === 'code'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Generate Code</span>
          </button>
        </div>

        {/* Right Desktop: Quick Action Buttons & Export Dropdown */}
        <div className="hidden md:flex items-center gap-2">
          {/* Upload / Import */}
          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Import Schema</span>
          </button>

          {/* Gemini AI Architect */}
          <button
            onClick={onOpenAi}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 hover:from-cyan-600/30 hover:to-purple-600/30 text-cyan-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-cyan-500/30 transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI Architect</span>
          </button>

          {/* Google Workspace */}
          <button
            onClick={onOpenWorkspace}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden xl:inline">Workspace</span>
          </button>

          {/* Multi-format Export Modal Trigger */}
          <button
            onClick={onOpenExport}
            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition active:scale-95"
            title="Download in HTML, PDF, SQL, CSV, Markdown, or ZIP formats"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Artifacts</span>
          </button>

          {/* User Profile / Auth */}
          {currentUser ? (
            <div
              onClick={onOpenWorkspace}
              title={`Signed in as ${currentUser.displayName || currentUser.email}`}
              className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-cyan-400"
            >
              {currentUser.displayName?.charAt(0) || 'U'}
            </div>
          ) : (
            <button
              onClick={onOpenWorkspace}
              title="Sign in with Google"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Dropdown Menu when toggled */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 border-t border-slate-800 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onOpenUpload();
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Import Schema</span>
              </button>

              <button
                onClick={() => {
                  onOpenAi();
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 bg-cyan-600/20 text-cyan-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-cyan-500/30"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Architect</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onOpenWorkspace();
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Workspace Sync</span>
              </button>

              <button
                onClick={() => {
                  onOpenExport();
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>All Downloads</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};


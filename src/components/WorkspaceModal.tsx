import React, { useState, useEffect } from 'react';
import { CanonicalSchema } from '../types/schema';
import {
  exportToGoogleDoc,
  exportToGoogleTasks,
  sendToGoogleChat,
  listChatSpaces,
  WorkspaceDocResult,
  WorkspaceTaskResult
} from '../services/workspace/googleWorkspace';
import { googleSignIn, googleSignOut, auth } from '../services/firebase/firebase';
import {
  FileText,
  CheckSquare,
  MessageSquare,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: CanonicalSchema;
  currentUser: User | null;
  onUserChanged: (user: User | null) => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  schema,
  currentUser,
  onUserChanged
}) => {
  const [activeAction, setActiveAction] = useState<'docs' | 'tasks' | 'chat'>('docs');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Results
  const [docResult, setDocResult] = useState<WorkspaceDocResult | null>(null);
  const [taskResult, setTaskResult] = useState<WorkspaceTaskResult | null>(null);
  const [chatSpaces, setChatSpaces] = useState<{ name: string; displayName: string }[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');

  if (!isOpen) return null;

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await googleSignIn();
      onUserChanged(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    onUserChanged(null);
  };

  const handleExportDoc = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await exportToGoogleDoc(schema);
      setDocResult(res);
      setSuccessMsg(`Google Doc created: "${res.title}"`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export to Google Docs');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTasks = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await exportToGoogleTasks(schema);
      setTaskResult(res);
      setSuccessMsg(`Created ${res.taskCount} migration tasks in Google Tasks!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export to Google Tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!selectedSpace) {
      setErrorMsg('Please select a Google Chat space first.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await sendToGoogleChat(schema, selectedSpace);
      setSuccessMsg('Schema analysis alert successfully posted to Google Chat space!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post message to Google Chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div
        id="workspace-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                Google Workspace Integration
              </h3>
              <p className="text-xs text-slate-400">
                Sync data dictionaries to Google Docs, tasks to Google Tasks, and alerts to Google Chat
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

        {/* Auth Banner */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-[10px]">
                {currentUser.displayName?.charAt(0) || 'U'}
              </div>
              <div>
                <span className="font-semibold text-slate-200">{currentUser.displayName || currentUser.email}</span>
                <span className="text-[10px] text-emerald-400 ml-2">● Workspace Connected</span>
              </div>
            </div>
          ) : (
            <div className="text-slate-400">
              Sign in with Google to enable Docs, Tasks, and Chat synchronization.
            </div>
          )}

          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded flex items-center gap-1 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-blue-600/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in with Google
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveAction('docs')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeAction === 'docs'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            Google Docs
          </button>

          <button
            onClick={() => setActiveAction('tasks')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeAction === 'tasks'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            Google Tasks
          </button>

          <button
            onClick={() => setActiveAction('chat')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeAction === 'chat'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-amber-400" />
            Google Chat
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action 1: Google Docs */}
          {activeAction === 'docs' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Export Data Dictionary & Architecture Doc
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Generates an organized technical specification document directly in your Google Docs, detailing tables, column types, constraints, foreign keys, and diagnostic warnings.
                </p>
              </div>

              {docResult && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Document Created</p>
                    <p className="text-[11px] text-slate-400">{docResult.title}</p>
                  </div>
                  <a
                    href={docResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    Open in Google Docs <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <button
                onClick={handleExportDoc}
                disabled={loading || !currentUser}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-blue-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>Export Schema to Google Docs</span>
              </button>
            </div>
          )}

          {/* Action 2: Google Tasks */}
          {activeAction === 'tasks' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Generate Database Migration Checklist
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Creates a task list in your Google Tasks containing step-by-step action items for applying migrations, verifying foreign keys, and addressing schema warnings.
                </p>
              </div>

              {taskResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
                  ✓ Created {taskResult.taskCount} checklist items in task list <span className="font-mono text-cyan-400">SchemaForge: {schema.database.engine.toUpperCase()} Migration Tasks</span>.
                </div>
              )}

              <button
                onClick={handleExportTasks}
                disabled={loading || !currentUser}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-emerald-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                <span>Create Tasks in Google Tasks</span>
              </button>
            </div>
          )}

          {/* Action 3: Google Chat */}
          {activeAction === 'chat' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Broadcast Schema Report to Google Chat
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Posts a formatted schema summary (tables, health score, active findings) into a Google Chat space for team review.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Google Chat Space Name or ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. spaces/AAAA1234567"
                  value={selectedSpace}
                  onChange={e => setSelectedSpace(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSendChat}
                disabled={loading || !currentUser || !selectedSpace}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-amber-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                <span>Send Alert to Google Chat Space</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

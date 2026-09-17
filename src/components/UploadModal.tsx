import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCode,
  FileArchive,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { SAMPLE_DATABASES, SampleDatabase } from '../fixtures/sampleDatabases';
import { parseSql } from '../services/parsers/sqlParser';
import { parseJson } from '../services/parsers/jsonParser';
import { unpackZipFile, mergeParsedSchemas } from '../services/parsers/zipParser';
import { analyzeSchema } from '../services/analyzer/schemaAnalyzer';
import { CanonicalSchema, DatabaseEngine, ImportState } from '../types/schema';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchemaLoaded: (schema: CanonicalSchema) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSchemaLoaded
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    filesCount: 0,
    currentStep: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    setImportState({
      status: 'uploading',
      progress: 15,
      filesCount: files.length,
      currentStep: `Reading ${files.length} file(s)...`
    });

    try {
      const parsedOutputs: any[] = [];
      const sourceManifest: { name: string; size: number; type: 'sql' | 'json' | 'zip' }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();

        setImportState({
          status: 'scanning',
          progress: Math.round(20 + (i / files.length) * 40),
          filesCount: files.length,
          currentStep: `Inspecting ${file.name}...`
        });

        if (ext === 'zip') {
          sourceManifest.push({ name: file.name, size: file.size, type: 'zip' });
          const buffer = await file.arrayBuffer();
          const unpacked = await unpackZipFile(buffer);

          for (const item of unpacked) {
            if (item.type === 'sql') {
              const res = parseSql(item.content, item.name);
              parsedOutputs.push({
                filename: item.name,
                tables: res.tables,
                warnings: res.warnings,
                engine: res.engine
              });
            } else if (item.type === 'json') {
              const res = parseJson(item.content, item.name);
              parsedOutputs.push({
                filename: item.name,
                tables: res.tables,
                warnings: res.warnings
              });
            }
          }
        } else if (ext === 'sql') {
          sourceManifest.push({ name: file.name, size: file.size, type: 'sql' });
          const text = await file.text();
          const res = parseSql(text, file.name);
          parsedOutputs.push({
            filename: file.name,
            tables: res.tables,
            warnings: res.warnings,
            engine: res.engine
          });
        } else if (ext === 'json') {
          sourceManifest.push({ name: file.name, size: file.size, type: 'json' });
          const text = await file.text();
          const res = parseJson(text, file.name);
          parsedOutputs.push({
            filename: file.name,
            tables: res.tables,
            warnings: res.warnings
          });
        }
      }

      setImportState({
        status: 'analyzing',
        progress: 80,
        filesCount: files.length,
        currentStep: 'Running relationship inference & health checks...'
      });

      // Merge tables across multiple files and run SchemaForge Analyzer
      const merged = mergeParsedSchemas(parsedOutputs);
      const schema = analyzeSchema(merged.tables, merged.warnings, merged.engine, sourceManifest);

      setImportState({
        status: 'completed',
        progress: 100,
        filesCount: files.length,
        currentStep: `Successfully parsed ${schema.tables.length} tables & ${schema.relationships.length} relationships!`
      });

      setTimeout(() => {
        onSchemaLoaded(schema);
        onClose();
        setImportState({ status: 'idle', progress: 0, filesCount: 0, currentStep: '' });
      }, 500);
    } catch (err: any) {
      setImportState({
        status: 'error',
        progress: 0,
        filesCount: files.length,
        currentStep: '',
        errorMessage: err.message || 'Failed to process files.'
      });
    }
  };

  const handleLoadSample = async (sample: SampleDatabase) => {
    setImportState({
      status: 'parsing',
      progress: 40,
      filesCount: sample.files.length,
      currentStep: `Loading ${sample.name}...`
    });

    try {
      const parsedOutputs: any[] = [];
      const sourceManifest: { name: string; size: number; type: 'sql' | 'json' | 'zip' }[] = [];

      for (const f of sample.files) {
        sourceManifest.push({ name: f.name, size: f.content.length, type: f.type });
        if (f.type === 'sql') {
          const res = parseSql(f.content, f.name);
          parsedOutputs.push({
            filename: f.name,
            tables: res.tables,
            warnings: res.warnings,
            engine: res.engine
          });
        } else {
          const res = parseJson(f.content, f.name);
          parsedOutputs.push({
            filename: f.name,
            tables: res.tables,
            warnings: res.warnings
          });
        }
      }

      const merged = mergeParsedSchemas(parsedOutputs);
      const schema = analyzeSchema(
        merged.tables,
        merged.warnings,
        sample.engine === 'json' ? 'mysql' : (sample.engine as DatabaseEngine),
        sourceManifest
      );

      setImportState({
        status: 'completed',
        progress: 100,
        filesCount: sample.files.length,
        currentStep: 'Schema loaded successfully!'
      });

      setTimeout(() => {
        onSchemaLoaded(schema);
        onClose();
        setImportState({ status: 'idle', progress: 0, filesCount: 0, currentStep: '' });
      }, 400);
    } catch (err: any) {
      setImportState({
        status: 'error',
        progress: 0,
        filesCount: sample.files.length,
        currentStep: '',
        errorMessage: err.message || 'Failed to load sample database.'
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div
        id="upload-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                Reverse Engineer Database Schema
              </h3>
              <p className="text-xs text-slate-400">
                Upload SQL DDL files, JSON document datasets, or entire ZIP archives
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

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            id="dropzone"
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              dragOver
                ? 'border-cyan-400 bg-cyan-950/30'
                : 'border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-950/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => e.target.files && processFiles(e.target.files)}
              multiple
              accept=".sql,.json,.zip"
              className="hidden"
            />
            <div className="p-3 bg-slate-800 rounded-full text-slate-300">
              <FileCode className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Drop your <span className="text-cyan-400">.sql</span>, <span className="text-amber-400">.json</span>, or <span className="text-purple-400">.zip</span> files here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports multi-file schemas, cross-file FK definitions, and nested archives
              </p>
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-md font-medium">
              Or click to browse files
            </span>
          </div>

          {/* Progress State Display */}
          {importState.status !== 'idle' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  {importState.currentStep || 'Processing...'}
                </span>
                <span className="text-cyan-400 font-mono font-bold">
                  {importState.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 transition-all duration-300"
                  style={{ width: `${importState.progress}%` }}
                />
              </div>
              {importState.errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 pt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{importState.errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Preset Sample Databases */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Or Explore Ready-to-Test Databases
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_DATABASES.map(sample => (
                <button
                  key={sample.id}
                  onClick={() => handleLoadSample(sample)}
                  className="flex flex-col text-left p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/40 transition group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 transition">
                      {sample.name}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {sample.engine}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                    {sample.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{sample.tablesCount} tables • {sample.files.length} file(s)</span>
                    <span className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-0.5 transition">
                      Load <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

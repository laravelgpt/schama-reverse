import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  CanonicalSchema,
  GeneratedFile
} from '../types/schema';
import {
  createDownloadPackage,
  downloadBlob
} from '../services/generators/exportZip';
import { generateLaravelFiles } from '../services/generators/laravelGenerator';
import { generateNodeFiles } from '../services/generators/nodeGenerator';
import { generateDbml } from '../services/generators/dbmlGenerator';
import { generateMermaid } from '../services/generators/mermaidGenerator';
import {
  generateHtmlReport,
  generatePdfReport,
  generateSqlDump,
  generateMarkdownDoc,
  generateCsvDictionary,
  downloadReportBlob
} from '../services/generators/reportGenerators';
import {
  FileCode,
  Download,
  Copy,
  Check,
  FolderArchive,
  Database,
  Layers,
  Sparkles,
  Globe,
  Printer,
  FileText,
  Table as TableIcon
} from 'lucide-react';

interface CodeGeneratorViewProps {
  schema: CanonicalSchema;
}

export const CodeGeneratorView: React.FC<CodeGeneratorViewProps> = ({ schema }) => {
  const [selectedCategory, setSelectedCategory] = useState<'migration' | 'model' | 'factory' | 'seeder' | 'schema' | 'dbml' | 'mermaid' | 'manifest' | 'docs' | 'reports'>('migration');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Generate all files dynamically from current schema
  const { files, allCategories } = useMemo(() => {
    const laravel = generateLaravelFiles(schema);
    const node = generateNodeFiles(schema);
    const dbml = generateDbml(schema);
    const mermaid = generateMermaid(schema);

    const manifest: GeneratedFile = {
      path: 'schemaforge-manifest.json',
      filename: 'schemaforge-manifest.json',
      category: 'manifest',
      content: JSON.stringify(
        {
          generator: 'SchemaForge',
          generator_version: '1.0.0',
          schema_version: schema.schemaVersion,
          database_engine: schema.database.engine,
          table_count: schema.tables.length,
          relationships_count: schema.relationships.length,
          health_score: schema.health.overallScore,
          generated_at: schema.generatedAt
        },
        null,
        2
      ),
      language: 'json'
    };

    const docs: GeneratedFile = {
      path: 'README.md',
      filename: 'README.md',
      category: 'docs',
      content: `# SchemaForge Generated Package\n\n- Engine: ${schema.database.engine}\n- Tables: ${schema.tables.length}\n- Health Score: ${schema.health.overallScore}/100\n\nGenerated automatically by SchemaForge.`,
      language: 'markdown'
    };

    const sqlContent = generateSqlDump(schema);
    const sqlFile: GeneratedFile = {
      path: `schema-${schema.database.engine}.sql`,
      filename: `schema-${schema.database.engine}.sql`,
      category: 'reports',
      content: sqlContent,
      language: 'sql'
    };

    const htmlContent = generateHtmlReport(schema);
    const htmlFile: GeneratedFile = {
      path: `data-dictionary.html`,
      filename: `data-dictionary.html`,
      category: 'reports',
      content: htmlContent,
      language: 'html'
    };

    const mdContent = generateMarkdownDoc(schema);
    const mdFile: GeneratedFile = {
      path: `DATABASE_DICTIONARY.md`,
      filename: `DATABASE_DICTIONARY.md`,
      category: 'reports',
      content: mdContent,
      language: 'markdown'
    };

    const csvContent = generateCsvDictionary(schema);
    const csvFile: GeneratedFile = {
      path: `data_dictionary.csv`,
      filename: `data_dictionary.csv`,
      category: 'reports',
      content: csvContent,
      language: 'text'
    };

    const combined: GeneratedFile[] = [
      ...laravel,
      ...node,
      sqlFile,
      htmlFile,
      mdFile,
      csvFile,
      dbml,
      mermaid,
      manifest,
      docs
    ];

    return {
      files: combined,
      allCategories: Array.from(new Set(combined.map(f => f.category)))
    };
  }, [schema]);

  const filteredFiles = files.filter(f => f.category === selectedCategory);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const activeFile = filteredFiles[selectedFileIndex] || filteredFiles[0] || files[0];

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await createDownloadPackage(schema);
      downloadBlob(blob, filename);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (err) {
      console.error('Download package error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Download ZIP and Quick Export options */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Export Production Artifacts & Migrations
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Laravel 13 ORM with PHP 8 #[] attributes (#[Table], #[UseFactory], #[Scope]), casts(): array, Model Factories, Migrations & Reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadZip}
            disabled={isExporting}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition active:scale-95 disabled:opacity-50"
          >
            <FolderArchive className="w-4 h-4" />
            {isExporting ? 'Packaging...' : 'Download ZIP'}
          </button>
          <button
            onClick={() => {
              const html = generateHtmlReport(schema);
              downloadReportBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `schemaforge-${schema.database.engine}-data-dictionary.html`);
            }}
            className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm font-semibold"
            title="Download standalone HTML data dictionary with live search"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">HTML Report</span>
          </button>
          <button
            onClick={() => generatePdfReport(schema)}
            className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm font-semibold"
            title="Open printable document with PDF save support"
          >
            <Printer className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
          <button
            onClick={() => {
              const sql = generateSqlDump(schema);
              downloadReportBlob(new Blob([sql], { type: 'application/sql;charset=utf-8' }), `schemaforge-${schema.database.engine}.sql`);
            }}
            className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm font-semibold"
            title="Download consolidated SQL DDL script"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">SQL DDL</span>
          </button>
        </div>
      </div>

      {/* Main Code View Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Side: Category Tabs & File Navigator */}
        <div className="md:col-span-4 bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
            {[
              { id: 'migration', label: 'Migrations' },
              { id: 'model', label: 'Models' },
              { id: 'factory', label: 'Factories' },
              { id: 'seeder', label: 'Seeders' },
              { id: 'reports', label: 'Reports & SQL' },
              { id: 'schema', label: 'Node JSON' },
              { id: 'dbml', label: 'DBML' },
              { id: 'mermaid', label: 'Mermaid' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id as any);
                  setSelectedFileIndex(0);
                }}
                className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Files List in Category */}
          <div className="space-y-1 overflow-y-auto max-h-[520px] pr-1">
            {filteredFiles.map((f, idx) => {
              const isSelected = activeFile?.path === f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-300 font-semibold border border-slate-700'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{f.filename}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase shrink-0">
                    {f.language}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Code Viewer */}
        <div className="md:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* File Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 font-semibold">
                {activeFile?.path}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Syntax Highlight Box */}
          <div className="p-4 bg-slate-950/90 overflow-x-auto max-h-[540px] font-mono text-xs text-slate-300 leading-relaxed select-text">
            <pre className="whitespace-pre">
              {activeFile?.content || '// No content generated'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

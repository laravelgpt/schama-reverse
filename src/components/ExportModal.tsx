import React, { useState } from 'react';
import { CanonicalSchema } from '../types/schema';
import {
  FolderArchive,
  FileCode,
  FileText,
  Table,
  Image,
  Globe,
  Printer,
  Download,
  Check,
  Sparkles,
  Database,
  X,
  Layers
} from 'lucide-react';
import {
  generateHtmlReport,
  generatePdfReport,
  generateSqlDump,
  generateMarkdownDoc,
  generateCsvDictionary,
  downloadReportBlob
} from '../services/generators/reportGenerators';
import { createDownloadPackage, downloadBlob } from '../services/generators/exportZip';
import confetti from 'canvas-confetti';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: CanonicalSchema;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  schema,
  svgRef
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setDownloadingId('zip');
    try {
      const { blob, filename } = await createDownloadPackage(schema);
      downloadBlob(blob, filename);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });
    } catch (err) {
      console.error('Error downloading zip:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadHtml = () => {
    setDownloadingId('html');
    try {
      const html = generateHtmlReport(schema);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      downloadReportBlob(blob, `schemaforge-${schema.database.engine}-data-dictionary.html`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadingId('pdf');
    try {
      generatePdfReport(schema);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSql = () => {
    setDownloadingId('sql');
    try {
      const sql = generateSqlDump(schema);
      const blob = new Blob([sql], { type: 'application/sql;charset=utf-8' });
      downloadReportBlob(blob, `schemaforge-${schema.database.engine}-ddl.sql`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadMarkdown = () => {
    setDownloadingId('md');
    try {
      const md = generateMarkdownDoc(schema);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      downloadReportBlob(blob, `schemaforge-${schema.database.engine}-documentation.md`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCsv = () => {
    setDownloadingId('csv');
    try {
      const csv = generateCsvDictionary(schema);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadReportBlob(blob, `schemaforge-${schema.database.engine}-columns.csv`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSvg = () => {
    setDownloadingId('svg');
    try {
      if (svgRef?.current) {
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        downloadReportBlob(blob, `schemaforge-${schema.database.engine}-erd.svg`);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const exportOptions = [
    {
      id: 'zip',
      title: 'Complete Project Archive (.zip)',
      badge: 'Recommended',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      description: 'Includes Laravel 13 migrations, Eloquent models, seeders, Node JSON, DBML, and Mermaid ERD.',
      icon: FolderArchive,
      iconColor: 'text-cyan-400',
      action: handleDownloadZip
    },
    {
      id: 'html',
      title: 'Interactive HTML Data Dictionary (.html)',
      badge: 'Standalone',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Single-file offline application with live search, column tables, and foreign-key relation matrix.',
      icon: Globe,
      iconColor: 'text-emerald-400',
      action: handleDownloadHtml
    },
    {
      id: 'pdf',
      title: 'Printable Architecture PDF Dossier (.pdf)',
      badge: 'Print-Ready',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      description: 'Professional executive summary, health scores, and table specifications formatted for PDF export.',
      icon: Printer,
      iconColor: 'text-purple-400',
      action: handleDownloadPdf
    },
    {
      id: 'sql',
      title: 'Consolidated SQL DDL Script (.sql)',
      badge: 'Ready to Run',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      description: `Complete executable CREATE TABLE, UNIQUE, and FOREIGN KEY statements for ${schema.database.engine.toUpperCase()}.`,
      icon: Database,
      iconColor: 'text-blue-400',
      action: handleDownloadSql
    },
    {
      id: 'md',
      title: 'Markdown Schema Documentation (.md)',
      badge: 'GitHub / Wiki',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: 'GitHub-flavored markdown data dictionary with embedded Mermaid ERD diagram.',
      icon: FileText,
      iconColor: 'text-amber-400',
      action: handleDownloadMarkdown
    },
    {
      id: 'csv',
      title: 'Data Dictionary Spreadsheet (.csv)',
      badge: 'Excel / Sheets',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      description: 'Tabular specification of all tables, columns, data types, nullability, and primary/foreign keys.',
      icon: Table,
      iconColor: 'text-teal-400',
      action: handleDownloadCsv
    },
    {
      id: 'svg',
      title: 'Vector ERD Diagram (.svg)',
      badge: 'Vector',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      description: 'Infinite-resolution vector graphic of the current ERD diagram with Crow’s Foot notation.',
      icon: Image,
      iconColor: 'text-sky-400',
      action: handleDownloadSvg
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Export Database Artifacts & Documentation
              </h2>
              <p className="text-xs text-slate-400">
                Choose from production packages, interactive HTML, PDF dossiers, or spreadsheet formats.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 divide-y divide-slate-800/40">
          {exportOptions.map(opt => {
            const Icon = opt.icon;
            const isDownloading = downloadingId === opt.id;

            return (
              <div
                key={opt.id}
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-800/40 transition group border border-transparent hover:border-slate-800"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0 mt-0.5">
                    <Icon className={`w-4 h-4 ${opt.iconColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-100 font-mono">
                        {opt.title}
                      </span>
                      {opt.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={opt.action}
                  disabled={isDownloading}
                  className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 self-end sm:self-center disabled:opacity-50"
                >
                  {isDownloading ? (
                    <span className="animate-pulse">Generating...</span>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-500">
          <span>Engine: <strong className="text-slate-300 uppercase font-mono">{schema.database.engine}</strong> &bull; {schema.tables.length} tables &bull; {schema.relationships.length} relations</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

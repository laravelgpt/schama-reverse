import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import { CanonicalSchema } from './types/schema';
import { SAMPLE_DATABASES } from './fixtures/sampleDatabases';
import { parseSql } from './services/parsers/sqlParser';
import { mergeParsedSchemas } from './services/parsers/zipParser';
import { analyzeSchema } from './services/analyzer/schemaAnalyzer';
import { initAuth, saveProjectToFirestore } from './services/firebase/firebase';
import { createDownloadPackage, downloadBlob } from './services/generators/exportZip';

import { Header } from './components/Header';
import { ErdCanvas } from './components/ErdCanvas';
import { SchemaExplorer } from './components/SchemaExplorer';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { CodeGeneratorView } from './components/CodeGeneratorView';
import { UploadModal } from './components/UploadModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { WorkspaceModal } from './components/WorkspaceModal';
import { ExportModal } from './components/ExportModal';

export function App() {
  // Initial default schema loaded from Ecommerce MySQL fixture
  const [schema, setSchema] = useState<CanonicalSchema>(() => {
    const ecom = SAMPLE_DATABASES[0];
    const outputs = ecom.files.map(f => {
      const parsed = parseSql(f.content, f.name);
      return {
        filename: f.name,
        tables: parsed.tables,
        warnings: parsed.warnings,
        engine: parsed.engine
      };
    });
    const merged = mergeParsedSchemas(outputs);
    return analyzeSchema(
      merged.tables,
      merged.warnings,
      'mysql',
      ecom.files.map(f => ({ name: f.name, size: f.content.length, type: 'sql' }))
    );
  });

  const [activeView, setActiveView] = useState<'erd' | 'explorer' | 'diagnostics' | 'code'>('erd');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Auth User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      user => {
        setCurrentUser(user);
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync schema to Firestore whenever user is logged in
  useEffect(() => {
    if (currentUser && schema) {
      saveProjectToFirestore(
        {
          id: `proj-${schema.database.engine}-${schema.tables.length}`,
          name: `SchemaForge ${schema.database.engine.toUpperCase()} Database`,
          description: `Reverse engineered schema with ${schema.tables.length} tables and ${schema.relationships.length} relationships`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          schema
        },
        currentUser
      );
    }
  }, [schema, currentUser]);

  const handleDownloadZip = async () => {
    try {
      const { blob, filename } = await createDownloadPackage(schema);
      downloadBlob(blob, filename);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 }
      });
    } catch (err) {
      console.error('Failed to export zip:', err);
    }
  };

  const handleLoadGeneratedSql = (sql: string) => {
    const parsed = parseSql(sql, 'ai-generated-schema.sql');
    const newSchema = analyzeSchema(parsed.tables, parsed.warnings, parsed.engine, [
      { name: 'ai-generated-schema.sql', size: sql.length, type: 'sql' }
    ]);
    setSchema(newSchema);
    setIsAiOpen(false);
    setActiveView('erd');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* App Header */}
      <Header
        schema={schema}
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
        onOpenWorkspace={() => setIsWorkspaceOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onDownloadZip={handleDownloadZip}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Quick Schema Overview Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/60 border border-slate-800 px-4 py-2.5 rounded-xl">
          <div className="flex items-center gap-4 text-slate-400">
            <div>
              <span className="text-slate-500">Database:</span>{' '}
              <span className="text-slate-200 font-semibold uppercase font-mono">{schema.database.engine}</span>
            </div>
            <div>
              <span className="text-slate-500">Entities:</span>{' '}
              <span className="text-slate-200 font-semibold font-mono">{schema.tables.length} tables</span>
            </div>
            <div>
              <span className="text-slate-500">Relations:</span>{' '}
              <span className="text-cyan-400 font-semibold font-mono">{schema.relationships.length} detected</span>
            </div>
            <div>
              <span className="text-slate-500">Health:</span>{' '}
              <span
                className={`font-semibold font-mono ${
                  schema.health.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {schema.health.overallScore}/100
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedTable && (
              <span className="text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-0.5 rounded-md font-mono">
                Focused: {selectedTable}
                <button
                  onClick={() => setSelectedTable(null)}
                  className="ml-1.5 text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 font-medium hover:underline"
            >
              Change Database / Presets →
            </button>
          </div>
        </div>

        {/* Dynamic Views */}
        {activeView === 'erd' && (
          <ErdCanvas
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={tableName => {
              setSelectedTable(tableName);
              if (tableName) {
                // optionally we keep user on ERD or allow quick inspect
              }
            }}
          />
        )}

        {activeView === 'explorer' && (
          <SchemaExplorer
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={tableName => setSelectedTable(tableName)}
          />
        )}

        {activeView === 'diagnostics' && (
          <AnalysisDashboard
            schema={schema}
          />
        )}

        {activeView === 'code' && (
          <CodeGeneratorView
            schema={schema}
          />
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSchemaLoaded={newSchema => {
          setSchema(newSchema);
          setSelectedTable(null);
          setActiveView('erd');
        }}
      />

      <AiAssistantModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        schema={schema}
        onLoadGeneratedSql={handleLoadGeneratedSql}
      />

      <WorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        schema={schema}
        currentUser={currentUser}
        onUserChanged={user => setCurrentUser(user)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        schema={schema}
      />
    </div>
  );
}

export default App;

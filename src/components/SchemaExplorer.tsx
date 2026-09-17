import React, { useState } from 'react';
import {
  CanonicalSchema,
  TableDefinition,
  ColumnDefinition,
  AnalysisFinding
} from '../types/schema';
import {
  Table as TableIcon,
  Key,
  Link2,
  Database,
  Hash,
  AlertTriangle,
  Layers,
  FileText,
  Search,
  CheckCircle2
} from 'lucide-react';

interface SchemaExplorerProps {
  schema: CanonicalSchema;
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
}

export const SchemaExplorer: React.FC<SchemaExplorerProps> = ({
  schema,
  selectedTable,
  onSelectTable
}) => {
  const [activeTab, setActiveTab] = useState<'columns' | 'relationships' | 'indexes' | 'sample'>('columns');
  const [tableSearch, setTableSearch] = useState('');

  const currentTable = schema.tables.find(
    t => t.name.toLowerCase() === (selectedTable || schema.tables[0]?.name)?.toLowerCase()
  );

  const filteredTables = schema.tables.filter(t =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  if (!currentTable) {
    return (
      <div className="p-8 text-center text-slate-400">
        No tables available in the current schema.
      </div>
    );
  }

  // Find all relationships for current table
  const incomingRels = schema.relationships.filter(
    r => r.targetTable.toLowerCase() === currentTable.name.toLowerCase()
  );
  const outgoingRels = schema.relationships.filter(
    r => r.sourceTable.toLowerCase() === currentTable.name.toLowerCase()
  );

  // Warnings for this specific table
  const tableWarnings = schema.warnings.filter(
    w => w.table?.toLowerCase() === currentTable.name.toLowerCase()
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
      {/* Left Sidebar: Tables List */}
      <div className="md:col-span-4 bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>TABLES ({schema.tables.length})</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-800 px-1.5 py-0.5 rounded">
            {schema.database.engine}
          </span>
        </div>

        {/* Table Filter Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Filter tables..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Tables Scrollable List */}
        <div className="space-y-1 overflow-y-auto max-h-[560px] pr-1">
          {filteredTables.map(t => {
            const isSelected = t.name.toLowerCase() === currentTable.name.toLowerCase();
            const warningsCount = schema.warnings.filter(w => w.table?.toLowerCase() === t.name.toLowerCase()).length;

            return (
              <button
                key={t.name}
                onClick={() => onSelectTable(t.name)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition font-mono ${
                  isSelected
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <TableIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {warningsCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {t.columns.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Area: Deep Table Inspection */}
      <div className="md:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 overflow-hidden">
        {/* Table Title & Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-mono text-slate-100">
                {currentTable.name}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                ({currentTable.columns.length} columns, {currentTable.rowCountEstimate || currentTable.sampleRows?.length || 0} rows estimated)
              </span>
            </div>
            {currentTable.comment && (
              <p className="text-xs text-slate-400 italic mt-0.5">
                "{currentTable.comment}"
              </p>
            )}
          </div>

          {/* Table Tab Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full scrollbar-none shrink-0">
            <button
              onClick={() => setActiveTab('columns')}
              className={`px-3 py-1 text-xs rounded font-medium whitespace-nowrap transition ${
                activeTab === 'columns' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Columns ({currentTable.columns.length})
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`px-3 py-1 text-xs rounded font-medium whitespace-nowrap transition ${
                activeTab === 'relationships' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Relations ({incomingRels.length + outgoingRels.length})
            </button>
            <button
              onClick={() => setActiveTab('indexes')}
              className={`px-3 py-1 text-xs rounded font-medium whitespace-nowrap transition ${
                activeTab === 'indexes' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Indexes ({currentTable.indexes.length})
            </button>
            <button
              onClick={() => setActiveTab('sample')}
              className={`px-3 py-1 text-xs rounded font-medium whitespace-nowrap transition ${
                activeTab === 'sample' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sample Data ({currentTable.sampleRows?.length || 0})
            </button>
          </div>
        </div>

        {/* Table Warnings if any */}
        {tableWarnings.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3 space-y-1.5">
            {tableWarnings.map(w => (
              <div key={w.id} className="flex items-start gap-2 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold font-mono">[{w.code}]</span> {w.message}
                  {w.suggestion && (
                    <p className="text-[11px] text-amber-300/80 mt-0.5">↳ {w.suggestion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 1: Columns */}
        {activeTab === 'columns' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2 px-3">NAME</th>
                  <th className="py-2 px-3">CANONICAL TYPE</th>
                  <th className="py-2 px-3">NATIVE TYPE</th>
                  <th className="py-2 px-3">NULLABLE</th>
                  <th className="py-2 px-3">DEFAULT</th>
                  <th className="py-2 px-3">FLAGS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {currentTable.columns.map(col => {
                  const isPk = col.isPrimaryKey || currentTable.primaryKey.includes(col.name);
                  const isFk = col.isForeignKey || currentTable.foreignKeys.some(f => f.columns.includes(col.name));

                  return (
                    <tr key={col.name} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-semibold flex items-center gap-1.5 text-slate-200">
                        {isPk && <Key className="w-3.5 h-3.5 text-amber-400" />}
                        {isFk && <Link2 className="w-3.5 h-3.5 text-cyan-400" />}
                        {col.name}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300">{col.type}</td>
                      <td className="py-2.5 px-3 text-slate-400">{col.nativeType}</td>
                      <td className="py-2.5 px-3">
                        {col.nullable ? (
                          <span className="text-slate-400">YES</span>
                        ) : (
                          <span className="text-rose-400 font-bold">NO</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {col.default !== null ? String(col.default) : <span className="text-slate-600">NULL</span>}
                      </td>
                      <td className="py-2.5 px-3 flex items-center gap-1">
                        {isPk && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">
                            PK
                          </span>
                        )}
                        {isFk && (
                          <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30">
                            FK
                          </span>
                        )}
                        {col.autoIncrement && (
                          <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30">
                            AUTO_INC
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Relationships */}
        {activeTab === 'relationships' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Outgoing References (Belongs To)
              </h4>
              {outgoingRels.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No outgoing foreign keys defined.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingRels.map(rel => (
                    <div
                      key={rel.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-semibold">{rel.sourceColumns.join(', ')}</span>
                        <span className="text-slate-500">references</span>
                        <span className="text-amber-400 font-semibold">{rel.targetTable}.({rel.targetColumns.join(', ')})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded">
                        {rel.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Incoming References (Has Many)
              </h4>
              {incomingRels.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No other tables reference this table.</p>
              ) : (
                <div className="space-y-2">
                  {incomingRels.map(rel => (
                    <div
                      key={rel.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-semibold">{rel.sourceTable}.({rel.sourceColumns.join(', ')})</span>
                        <span className="text-slate-500">points to</span>
                        <span className="text-cyan-400 font-semibold">{rel.targetColumns.join(', ')}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded">
                        {rel.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Indexes */}
        {activeTab === 'indexes' && (
          <div className="space-y-2">
            {currentTable.indexes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No secondary indexes defined for this table.</p>
            ) : (
              currentTable.indexes.map(idx => (
                <div
                  key={idx.name}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{idx.name}</span>
                    <span className="text-slate-400 ml-2">({idx.columns.join(', ')})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {idx.unique && (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                        UNIQUE
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {idx.type || 'BTREE'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Sample Data */}
        {activeTab === 'sample' && (
          <div className="overflow-x-auto max-h-[480px]">
            {(!currentTable.sampleRows || currentTable.sampleRows.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No sample data rows found in SQL DDL statements for this table.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    {Object.keys(currentTable.sampleRows[0]).map(k => (
                      <th key={k} className="py-2 px-3">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {currentTable.sampleRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="py-2 px-3 text-slate-300 truncate max-w-xs">
                          {val === null ? <span className="text-slate-600">NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

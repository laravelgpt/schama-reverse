import React, { useState } from 'react';
import {
  CanonicalSchema,
  AnalysisFinding
} from '../types/schema';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Database,
  Link2,
  Key,
  Check,
  X,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface AnalysisDashboardProps {
  schema: CanonicalSchema;
  onUpdateFindings?: (updatedFindings: AnalysisFinding[]) => void;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  schema,
  onUpdateFindings
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const { health } = schema;
  const totalColumns = schema.tables.reduce((acc, t) => acc + t.columns.length, 0);
  const totalFks = schema.tables.reduce((acc, t) => acc + t.foreignKeys.length, 0);
  const totalIndexes = schema.tables.reduce((acc, t) => acc + t.indexes.length, 0);

  const activeFindings = schema.warnings.filter(w => !resolvedIds.has(w.id));

  const filteredFindings = activeFindings.filter(w => {
    if (selectedSeverity === 'all') return true;
    return w.severity === selectedSeverity;
  });

  const handleResolve = (id: string) => {
    const next = new Set(resolvedIds);
    next.add(id);
    setResolvedIds(next);
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    if (score >= 65) return 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20';
    if (score >= 45) return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
    return 'text-rose-400 border-rose-500/30 bg-rose-950/20';
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Bento Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>HEALTH SCORE</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-bold font-mono ${health.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health.overallScore}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>TABLES</span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {schema.tables.length}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>COLUMNS</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {totalColumns}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>RELATIONSHIPS</span>
            <Link2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {schema.relationships.length}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>INDEXES</span>
            <Key className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {totalIndexes}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>ACTIVE FINDINGS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-bold font-mono ${activeFindings.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {activeFindings.length}
            </span>
          </div>
        </div>
      </div>

      {/* Schema Health Deep Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-wide">
              Transparent Schema Health & Performance Index
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated audit covering referential integrity, indexing efficiency, and schema constraints.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg border font-mono font-bold text-xs ${getHealthColor(health.overallScore)}`}>
            Score: {health.overallScore}/100
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {health.metrics.map(metric => (
            <div
              key={metric.label}
              className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">{metric.label}</span>
                <span className={`font-mono font-bold ${metric.pass ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {metric.score}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    metric.pass ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${metric.score}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {metric.value}
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {metric.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Findings & Review Queue */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-wide">
              Schema Review Queue & Diagnostic Findings
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review schema warnings, type mismatches, missing foreign keys, and circular dependencies.
            </p>
          </div>

          {/* Severity Filters */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {['all', 'critical', 'error', 'warning', 'notice'].map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2.5 py-1 rounded font-medium capitalize transition ${
                  selectedSeverity === sev ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-200">
              No active findings in this category!
            </p>
            <p className="text-xs text-slate-500">
              Your schema passes all referential integrity and normalization validations.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredFindings.map(finding => {
              const isCrit = finding.severity === 'critical';
              const isErr = finding.severity === 'error';
              const isWarn = finding.severity === 'warning';

              return (
                <div
                  key={finding.id}
                  className={`p-3.5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition ${
                    isCrit
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : isErr
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : isWarn
                      ? 'bg-yellow-950/15 border-yellow-500/25'
                      : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isCrit || isErr ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Info className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-200">
                          {finding.code}
                        </span>
                        {finding.table && (
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                            {finding.table}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : isErr
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {finding.message}
                      </p>
                      {finding.suggestion && (
                        <p className="text-[11px] text-cyan-400/90 mt-1">
                          💡 Suggestion: {finding.suggestion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => handleResolve(finding.id)}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Resolve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

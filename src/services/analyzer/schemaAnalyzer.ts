import {
  AnalysisFinding,
  CanonicalSchema,
  DatabaseEngine,
  HealthMetric,
  RelationshipDefinition,
  SchemaHealth,
  TableDefinition
} from '../../types/schema';

export function analyzeSchema(
  tables: TableDefinition[],
  parsedWarnings: AnalysisFinding[] = [],
  engine: DatabaseEngine = 'mysql',
  sourceFiles: { name: string; size: number; type: 'sql' | 'json' | 'zip' }[] = []
): CanonicalSchema {
  const warnings: AnalysisFinding[] = [...parsedWarnings];
  const relationships: RelationshipDefinition[] = [];
  const tableNames = new Set(tables.map(t => t.name.toLowerCase()));
  const tableMap = new Map<string, TableDefinition>();
  tables.forEach(t => tableMap.set(t.name.toLowerCase(), t));

  // 1. Process Explicit Foreign Keys (Level 1 - Authoritative)
  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      const targetTableLower = fk.referencedTable.toLowerCase();
      const targetTable = tableMap.get(targetTableLower);

      if (!targetTable) {
        warnings.push({
          id: `warn-orphan-table-${table.name}-${fk.referencedTable}`,
          code: 'ORPHAN_FOREIGN_KEY',
          message: `Table '${table.name}' references non-existent table '${fk.referencedTable}'`,
          severity: 'critical',
          table: table.name,
          suggestion: 'Ensure referenced table is created or imported, or review table naming.'
        });
        continue;
      }

      // Check referenced columns
      const refColName = fk.referencedColumns[0] || 'id';
      const refCol = targetTable.columns.find(c => c.name.toLowerCase() === refColName.toLowerCase());
      if (!refCol && targetTable.columns.length > 0) {
        warnings.push({
          id: `warn-orphan-col-${table.name}-${refColName}`,
          code: 'ORPHAN_FOREIGN_KEY_COLUMN',
          message: `Foreign key on '${table.name}.${fk.columns.join(',')}' references unknown column '${targetTable.name}.${refColName}'`,
          severity: 'error',
          table: table.name,
          suggestion: `Referenced table '${targetTable.name}' does not have column '${refColName}'.`
        });
      }

      // Check Type Mismatch between FK column and PK column
      if (refCol) {
        const srcColName = fk.columns[0];
        const srcCol = table.columns.find(c => c.name.toLowerCase() === srcColName.toLowerCase());
        if (srcCol && srcCol.type !== refCol.type && srcCol.type !== 'string' && refCol.type !== 'string') {
          warnings.push({
            id: `warn-mismatch-${table.name}-${srcColName}`,
            code: 'TYPE_MISMATCH',
            message: `Type mismatch on FK: '${table.name}.${srcColName}' (${srcCol.type}) references '${targetTable.name}.${refCol.name}' (${refCol.type})`,
            severity: 'warning',
            table: table.name,
            column: srcColName,
            suggestion: `Align column types so both are ${refCol.type} for optimal join performance and indexing.`
          });
        }
      }

      // Determine Cardinality
      // If FK columns form unique constraint or PK, it's 1:1, else 1:N
      const isUniqueFk = table.uniqueConstraints.some(
        uq => uq.length === fk.columns.length && uq.every(c => fk.columns.includes(c))
      ) || (table.primaryKey.length === fk.columns.length && table.primaryKey.every(c => fk.columns.includes(c)));

      const relType = isUniqueFk ? 'one-to-one' : 'many-to-one';

      relationships.push({
        id: `rel-${table.name}-${targetTable.name}-${fk.columns.join('_')}`,
        sourceTable: table.name,
        sourceColumns: fk.columns,
        targetTable: targetTable.name,
        targetColumns: fk.referencedColumns,
        type: relType,
        confidence: 'authoritative',
        evidence: fk.evidence || `Foreign key constraint ${fk.name || ''} explicitly references ${targetTable.name}`
      });
    }
  }

  // 2. Structural & Naming Inference (Level 2 & Level 3)
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.isPrimaryKey || col.isForeignKey) continue;

      const colNameLower = col.name.toLowerCase();

      // Check standard naming convention: e.g. user_id, order_id, tenant_id
      const idMatch = colNameLower.match(/^([a-z0-9_]+)_id$/);
      if (idMatch) {
        const singularName = idMatch[1];
        // Test plural variations: users, categories, orders, etc.
        const pluralCandidates = [
          singularName + 's',
          singularName + 'es',
          singularName.replace(/y$/, 'ies'),
          singularName
        ];

        let matchedTarget: TableDefinition | null = null;
        for (const candidate of pluralCandidates) {
          if (tableMap.has(candidate) && candidate !== table.name.toLowerCase()) {
            matchedTarget = tableMap.get(candidate)!;
            break;
          }
        }

        if (matchedTarget) {
          // Already registered in explicit relationships?
          const alreadyExists = relationships.some(
            r => r.sourceTable.toLowerCase() === table.name.toLowerCase() &&
                 r.sourceColumns.includes(col.name) &&
                 r.targetTable.toLowerCase() === matchedTarget!.name.toLowerCase()
          );

          if (!alreadyExists) {
            const targetPk = matchedTarget.primaryKey[0] || 'id';
            relationships.push({
              id: `rel-inf-${table.name}-${matchedTarget.name}-${col.name}`,
              sourceTable: table.name,
              sourceColumns: [col.name],
              targetTable: matchedTarget.name,
              targetColumns: [targetPk],
              type: 'many-to-one',
              confidence: 'inferred',
              evidence: `Structural inference: column '${col.name}' matches target table '${matchedTarget.name}.${targetPk}' (Confidence: 88%)`
            });

            warnings.push({
              id: `warn-inf-fk-${table.name}-${col.name}`,
              code: 'POSSIBLE_RELATIONSHIP',
              message: `Inferred relationship between '${table.name}.${col.name}' and '${matchedTarget.name}.${targetPk}'`,
              severity: 'notice',
              table: table.name,
              column: col.name,
              suggestion: 'Consider defining an explicit foreign key constraint in your migration'
            });
          }
        } else {
          // Level 3: Semantic similarity for roles like author_id, customer_id, creator_id -> users
          if (['author_id', 'creator_id', 'owner_id', 'buyer_id', 'seller_id', 'sender_id', 'receiver_id'].includes(colNameLower)) {
            if (tableMap.has('users') && table.name.toLowerCase() !== 'users') {
              const usersTable = tableMap.get('users')!;
              const alreadyExists = relationships.some(
                r => r.sourceTable.toLowerCase() === table.name.toLowerCase() && r.sourceColumns.includes(col.name)
              );
              if (!alreadyExists) {
                relationships.push({
                  id: `rel-sim-${table.name}-users-${col.name}`,
                  sourceTable: table.name,
                  sourceColumns: [col.name],
                  targetTable: usersTable.name,
                  targetColumns: ['id'],
                  type: 'many-to-one',
                  confidence: 'possible',
                  evidence: `Semantic role inference: '${col.name}' is a common role reference to 'users.id' (Confidence: 65%)`
                });
              }
            }
          }
        }
      }
    }
  }

  // 3. Detect Many-to-Many Junction Tables
  for (const table of tables) {
    const tableRels = relationships.filter(r => r.sourceTable.toLowerCase() === table.name.toLowerCase());
    if (tableRels.length === 2 && table.columns.length <= 6) {
      // High probability junction table! (e.g. role_user, order_item, taggables)
      const relA = tableRels[0];
      const relB = tableRels[1];

      // Add composite many-to-many relationship
      relationships.push({
        id: `rel-m2m-${relA.targetTable}-${relB.targetTable}-${table.name}`,
        sourceTable: relA.targetTable,
        sourceColumns: relA.targetColumns,
        targetTable: relB.targetTable,
        targetColumns: relB.targetColumns,
        type: 'many-to-many',
        junctionTable: table.name,
        confidence: 'authoritative',
        evidence: `Junction table '${table.name}' bridges '${relA.targetTable}' and '${relB.targetTable}'`
      });
    }
  }

  // 4. Primary Key and Index Inspection
  for (const table of tables) {
    if (table.primaryKey.length === 0) {
      warnings.push({
        id: `warn-nopk-${table.name}`,
        code: 'MISSING_PRIMARY_KEY',
        message: `Table '${table.name}' does not have a primary key defined`,
        severity: 'warning',
        table: table.name,
        suggestion: 'Add an auto-incrementing ID or UUID primary key.'
      });
    }

    // Check duplicate indexes
    const seenIndexCols = new Set<string>();
    for (const idx of table.indexes) {
      const colKey = idx.columns.join(',');
      if (seenIndexCols.has(colKey)) {
        warnings.push({
          id: `warn-dupidx-${table.name}-${idx.name}`,
          code: 'DUPLICATE_INDEX',
          message: `Redundant index '${idx.name}' on '${table.name} (${colKey})'`,
          severity: 'notice',
          table: table.name,
          suggestion: 'Drop duplicate index to reduce write overhead.'
        });
      }
      seenIndexCols.add(colKey);
    }
  }

  // 5. Circular Dependency Check
  const circulars = findCircularDependencies(relationships);
  for (const circ of circulars) {
    warnings.push({
      id: `warn-circ-${circ.join('-')}`,
      code: 'CIRCULAR_SCHEMA_DEPENDENCY',
      message: `Circular dependency detected between tables: ${circ.join(' ↔ ')}`,
      severity: 'warning',
      suggestion: 'SchemaForge will generate two-phase migrations (tables created first, FKs added after) to prevent migration deadlock.'
    });
  }

  // 6. Calculate Transparent Schema Health
  const health = calculateSchemaHealth(tables, relationships, warnings);

  return {
    schemaVersion: '1.0',
    database: {
      engine,
      version: engine === 'mysql' ? '8.0' : engine === 'postgresql' ? '16' : '3.45',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    },
    tables,
    relationships,
    warnings,
    health,
    sourceFiles,
    generatedAt: new Date().toISOString()
  };
}

function findCircularDependencies(relationships: RelationshipDefinition[]): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const r of relationships) {
    if (r.type === 'many-to-many') continue;
    const src = r.sourceTable.toLowerCase();
    const dst = r.targetTable.toLowerCase();
    if (src === dst) continue; // self-referencing is fine
    if (!adj.has(src)) adj.set(src, new Set());
    adj.get(src)!.add(dst);
  }

  const circularPairs: string[][] = [];
  const checked = new Set<string>();

  for (const [a, targets] of adj.entries()) {
    for (const b of targets) {
      if (adj.has(b) && adj.get(b)!.has(a)) {
        const pairKey = [a, b].sort().join(':');
        if (!checked.has(pairKey)) {
          checked.add(pairKey);
          circularPairs.push([a, b]);
        }
      }
    }
  }

  return circularPairs;
}

function calculateSchemaHealth(
  tables: TableDefinition[],
  relationships: RelationshipDefinition[],
  warnings: AnalysisFinding[]
): SchemaHealth {
  if (tables.length === 0) {
    return {
      overallScore: 0,
      referentialIntegrity: 0,
      indexCoverage: 0,
      constraintCoverage: 0,
      parserConfidence: 0,
      metrics: []
    };
  }

  // 1. Referential integrity: % of relationships that have explicit foreign keys
  const totalRels = relationships.filter(r => r.type !== 'many-to-many').length;
  const explicitRels = relationships.filter(r => r.confidence === 'authoritative' && r.type !== 'many-to-many').length;
  const refIntegrityScore = totalRels === 0 ? 100 : Math.round((explicitRels / totalRels) * 100);

  // 2. PK coverage: % of tables with primary keys
  const tablesWithPk = tables.filter(t => t.primaryKey.length > 0).length;
  const pkScore = Math.round((tablesWithPk / tables.length) * 100);

  // 3. Index coverage: % of FK columns with an index
  let totalFkCols = 0;
  let indexedFkCols = 0;
  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      totalFkCols++;
      const isIndexed = table.indexes.some(idx =>
        fk.columns.every(col => idx.columns.includes(col))
      );
      if (isIndexed) indexedFkCols++;
    }
  }
  const indexCoverageScore = totalFkCols === 0 ? 95 : Math.round((indexedFkCols / totalFkCols) * 100);

  // 4. Constraint coverage: % of columns that specify NOT NULL or DEFAULT
  let totalCols = 0;
  let constrainedCols = 0;
  for (const table of tables) {
    for (const col of table.columns) {
      totalCols++;
      if (!col.nullable || col.default !== null || col.isPrimaryKey) {
        constrainedCols++;
      }
    }
  }
  const constraintScore = totalCols === 0 ? 100 : Math.round((constrainedCols / totalCols) * 100);

  // 5. Warnings penalty
  const criticalCount = warnings.filter(w => w.severity === 'critical').length;
  const errorCount = warnings.filter(w => w.severity === 'error').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  const warningPenalty = (criticalCount * 25) + (errorCount * 15) + (warningCount * 5);
  const baseScore = Math.round(
    (refIntegrityScore * 0.35) +
    (pkScore * 0.30) +
    (indexCoverageScore * 0.20) +
    (constraintScore * 0.15)
  );

  const overallScore = Math.max(10, Math.min(100, baseScore - warningPenalty));

  const metrics: HealthMetric[] = [
    {
      label: 'Primary Key Coverage',
      value: `${tablesWithPk} / ${tables.length} tables`,
      score: pkScore,
      pass: pkScore === 100,
      explanation: 'Every relational entity must have an explicit unique primary key identifier.'
    },
    {
      label: 'Referential Integrity',
      value: `${explicitRels} / ${totalRels} explicit constraints`,
      score: refIntegrityScore,
      pass: refIntegrityScore >= 80,
      explanation: 'Percentage of inter-table links enforced by database foreign key constraints.'
    },
    {
      label: 'Foreign Key Indexing',
      value: `${indexedFkCols} / ${totalFkCols} indexed keys`,
      score: indexCoverageScore,
      pass: indexCoverageScore >= 75,
      explanation: 'Indexed foreign keys avoid full table scans during joins and delete cascades.'
    },
    {
      label: 'Constraint Completeness',
      value: `${constrainedCols} / ${totalCols} defined fields`,
      score: constraintScore,
      pass: constraintScore >= 70,
      explanation: 'Columns with NOT NULL, DEFAULT, or CHECK enforce business logic at the storage layer.'
    }
  ];

  return {
    overallScore,
    referentialIntegrity: refIntegrityScore,
    indexCoverage: indexCoverageScore,
    constraintCoverage: constraintScore,
    parserConfidence: 98,
    metrics
  };
}

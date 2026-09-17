import {
  CanonicalSchema,
  ColumnDefinition,
  DatabaseEngine,
  ForeignKeyDefinition,
  IndexDefinition,
  TableDefinition,
  AnalysisFinding
} from '../../types/schema';

export function detectSqlEngine(sql: string): DatabaseEngine {
  const upper = sql.toUpperCase();
  if (upper.includes('ENGINE=INNODB') || upper.includes('AUTO_INCREMENT') || upper.includes('`')) {
    return 'mysql';
  }
  if (upper.includes('SERIAL') || upper.includes('BIGSERIAL') || upper.includes('VARCHAR2') || upper.includes('TIMESTAMPTZ') || upper.includes('UUID GENERATE')) {
    return 'postgresql';
  }
  if (upper.includes('AUTOINCREMENT') || upper.includes('PRAGMA') || upper.includes('WITHOUT ROWID')) {
    return 'sqlite';
  }
  if (upper.includes('IDENTITY(1,1)') || upper.includes('[DBO].') || upper.includes('NVARCHAR')) {
    return 'sqlserver';
  }
  return 'mysql';
}

function normalizeDataType(rawType: string): {
  type: string;
  nativeType: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
  unsigned: boolean;
} {
  const clean = rawType.trim();
  const unsigned = /\bunsigned\b/i.test(clean);
  const withoutUnsigned = clean.replace(/\bunsigned\b/gi, '').trim();

  const lengthMatch = withoutUnsigned.match(/\((?:(\d+)(?:\s*,\s*(\d+))?)\)/);
  let length: number | null = null;
  let precision: number | null = null;
  let scale: number | null = null;

  if (lengthMatch) {
    if (lengthMatch[2] !== undefined) {
      precision = parseInt(lengthMatch[1], 10);
      scale = parseInt(lengthMatch[2], 10);
    } else {
      length = parseInt(lengthMatch[1], 10);
    }
  }

  const baseType = withoutUnsigned.replace(/\(.*?\)/, '').trim().toLowerCase();

  let canonicalType = 'string';
  if (/^(bigint|int|integer|smallint|tinyint|mediumint)$/i.test(baseType)) {
    if (baseType === 'tinyint' && length === 1) {
      canonicalType = 'boolean';
    } else if (baseType === 'bigint') {
      canonicalType = 'bigint';
    } else {
      canonicalType = 'integer';
    }
  } else if (/^(decimal|numeric)$/i.test(baseType)) {
    canonicalType = 'decimal';
  } else if (/^(float|double|real)$/i.test(baseType)) {
    canonicalType = 'float';
  } else if (/^(varchar|nvarchar|char|nchar|character)$/i.test(baseType)) {
    canonicalType = 'string';
  } else if (/^(text|longtext|mediumtext|tinytext)$/i.test(baseType)) {
    canonicalType = 'text';
  } else if (/^(datetime|timestamp|timestamptz)$/i.test(baseType)) {
    canonicalType = 'datetime';
  } else if (/^date$/i.test(baseType)) {
    canonicalType = 'date';
  } else if (/^time$/i.test(baseType)) {
    canonicalType = 'time';
  } else if (/^(bool|boolean)$/i.test(baseType)) {
    canonicalType = 'boolean';
  } else if (/^(json|jsonb)$/i.test(baseType)) {
    canonicalType = 'json';
  } else if (/^uuid$/i.test(baseType)) {
    canonicalType = 'uuid';
  } else if (/^(blob|bytea|binary|varbinary)$/i.test(baseType)) {
    canonicalType = 'binary';
  }

  return {
    type: canonicalType,
    nativeType: rawType,
    length,
    precision,
    scale,
    unsigned
  };
}

function cleanIdentifier(id: string): string {
  return id.replace(/[`"'\[\]]/g, '').trim();
}

export function parseSql(sql: string, filename = 'database.sql'): {
  tables: TableDefinition[];
  warnings: AnalysisFinding[];
  engine: DatabaseEngine;
} {
  const engine = detectSqlEngine(sql);
  const tablesMap = new Map<string, TableDefinition>();
  const warnings: AnalysisFinding[] = [];

  // Remove multi-line comments /* ... */ and single line comments -- or #
  const sanitizedSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .replace(/#.*$/gm, '');

  // Split into statements safely
  const statements: string[] = [];
  let currentStmt = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sanitizedSql.length; i++) {
    const char = sanitizedSql[i];
    const prevChar = i > 0 ? sanitizedSql[i - 1] : '';

    if ((char === "'" || char === '"' || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }

    if (char === ';' && !inString) {
      if (currentStmt.trim()) {
        statements.push(currentStmt.trim());
      }
      currentStmt = '';
    } else {
      currentStmt += char;
    }
  }
  if (currentStmt.trim()) {
    statements.push(currentStmt.trim());
  }

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    // 1. CREATE TABLE
    const createTableMatch = trimmed.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\.)?[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*\(([\s\S]+)\)(?:\s*ENGINE\s*=\s*([a-zA-Z0-9_]+))?/i
    );

    if (createTableMatch) {
      const schemaName = createTableMatch[1];
      const tableName = cleanIdentifier(createTableMatch[2]);
      const body = createTableMatch[3];
      const tableEngine = createTableMatch[4] || (engine === 'mysql' ? 'InnoDB' : undefined);

      if (tablesMap.has(tableName)) {
        warnings.push({
          id: `warn-dup-${tableName}`,
          code: 'DUPLICATE_SCHEMA_DEFINITION',
          message: `Duplicate table definition found for '${tableName}' in ${filename}`,
          severity: 'warning',
          table: tableName,
          file: filename,
          suggestion: 'Table will be merged; check if migration split or conflict exists'
        });
      }

      const table: TableDefinition = tablesMap.get(tableName) || {
        name: tableName,
        schema: schemaName,
        engine: tableEngine,
        columns: [],
        primaryKey: [],
        foreignKeys: [],
        indexes: [],
        uniqueConstraints: [],
        checks: [],
        sampleRows: []
      };

      // Parse columns and inline constraints
      parseTableBody(body, table, filename, warnings);
      tablesMap.set(tableName, table);
      continue;
    }

    // 2. ALTER TABLE ADD CONSTRAINT FOREIGN KEY
    const alterFkMatch = trimmed.match(
      /ALTER\s+TABLE\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+ADD\s+(?:CONSTRAINT\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*\(([^)]+)\)(?:\s*ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s*ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
    );

    if (alterFkMatch) {
      const sourceTable = cleanIdentifier(alterFkMatch[1]);
      const fkName = alterFkMatch[2];
      const sourceCols = alterFkMatch[3].split(',').map(s => cleanIdentifier(s));
      const targetTable = cleanIdentifier(alterFkMatch[4]);
      const targetCols = alterFkMatch[5].split(',').map(s => cleanIdentifier(s));
      const onDelete = (alterFkMatch[6]?.toLowerCase().replace(/\s+/g, ' ') as any) || undefined;
      const onUpdate = (alterFkMatch[7]?.toLowerCase().replace(/\s+/g, ' ') as any) || undefined;

      const fkDef: ForeignKeyDefinition = {
        name: fkName,
        table: sourceTable,
        columns: sourceCols,
        referencedTable: targetTable,
        referencedColumns: targetCols,
        onDelete,
        onUpdate,
        confidence: 'authoritative',
        source: 'alter_table',
        evidence: `ALTER TABLE ${sourceTable} ADD FOREIGN KEY (${sourceCols.join(',')}) REFERENCES ${targetTable}(${targetCols.join(',')})`
      };

      let table = tablesMap.get(sourceTable);
      if (!table) {
        table = {
          name: sourceTable,
          columns: [],
          primaryKey: [],
          foreignKeys: [],
          indexes: [],
          uniqueConstraints: [],
          checks: []
        };
        tablesMap.set(sourceTable, table);
      }
      table.foreignKeys.push(fkDef);

      // Mark column as FK
      for (const col of table.columns) {
        if (sourceCols.includes(col.name)) {
          col.isForeignKey = true;
          col.references = { table: targetTable, column: targetCols[0] };
        }
      }
      continue;
    }

    // 3. CREATE [UNIQUE] INDEX
    const createIndexMatch = trimmed.match(
      /CREATE\s+(UNIQUE\s+)?INDEX\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+ON\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*\(([^)]+)\)/i
    );

    if (createIndexMatch) {
      const isUnique = !!createIndexMatch[1];
      const indexName = cleanIdentifier(createIndexMatch[2]);
      const tableName = cleanIdentifier(createIndexMatch[3]);
      const cols = createIndexMatch[4].split(',').map(s => cleanIdentifier(s));

      const table = tablesMap.get(tableName);
      if (table) {
        table.indexes.push({
          name: indexName,
          columns: cols,
          unique: isUnique,
          type: isUnique ? 'unique' as any : 'btree'
        });
      }
      continue;
    }

    // 4. INSERT INTO (extract sample data for seeders)
    const insertMatch = trimmed.match(
      /INSERT\s+INTO\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+)/i
    );

    if (insertMatch) {
      const tableName = cleanIdentifier(insertMatch[1]);
      const colListStr = insertMatch[2];
      const valuesStr = insertMatch[3];

      const table = tablesMap.get(tableName);
      if (table) {
        table.sampleRows = table.sampleRows || [];
        const cols = colListStr
          ? colListStr.split(',').map(s => cleanIdentifier(s))
          : table.columns.map(c => c.name);

        // Extract value tuples: (...), (...)
        const rowRegex = /\(([^)]+)\)/g;
        let rowMatch;
        let count = 0;
        while ((rowMatch = rowRegex.exec(valuesStr)) !== null && count < 100) {
          const rowVals = splitCsvValues(rowMatch[1]);
          const rowObj: Record<string, any> = {};
          cols.forEach((col, idx) => {
            rowObj[col] = rowVals[idx] !== undefined ? rowVals[idx] : null;
          });
          table.sampleRows.push(rowObj);
          count++;
        }
        table.rowCountEstimate = (table.rowCountEstimate || 0) + count;
      }
    }
  }

  return {
    tables: Array.from(tablesMap.values()),
    warnings,
    engine
  };
}

function parseTableBody(
  body: string,
  table: TableDefinition,
  filename: string,
  warnings: AnalysisFinding[]
): void {
  // Split columns & table constraints by comma, respecting parentheses
  const lines: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;

    if (char === ',' && parenDepth === 0) {
      if (current.trim()) lines.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current.trim());

  for (const line of lines) {
    const trimmed = line.trim();

    // Primary Key constraint: PRIMARY KEY (col1, col2)
    const pkMatch = trimmed.match(/^(?:CONSTRAINT\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      const pkCols = pkMatch[2].split(',').map(c => cleanIdentifier(c));
      table.primaryKey = pkCols;
      table.columns.forEach(col => {
        if (pkCols.includes(col.name)) {
          col.isPrimaryKey = true;
        }
      });
      continue;
    }

    // Foreign Key constraint: FOREIGN KEY (col) REFERENCES target (col)
    const fkMatch = trimmed.match(
      /^(?:CONSTRAINT\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*\(([^)]+)\)(?:\s*ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s*ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
    );
    if (fkMatch) {
      const fkName = fkMatch[1];
      const srcCols = fkMatch[2].split(',').map(s => cleanIdentifier(s));
      const targetTable = cleanIdentifier(fkMatch[3]);
      const targetCols = fkMatch[4].split(',').map(s => cleanIdentifier(s));
      const onDelete = (fkMatch[5]?.toLowerCase().replace(/\s+/g, ' ') as any) || undefined;
      const onUpdate = (fkMatch[6]?.toLowerCase().replace(/\s+/g, ' ') as any) || undefined;

      table.foreignKeys.push({
        name: fkName,
        table: table.name,
        columns: srcCols,
        referencedTable: targetTable,
        referencedColumns: targetCols,
        onDelete,
        onUpdate,
        confidence: 'authoritative',
        source: 'inline_constraint',
        evidence: `Inline FK: (${srcCols.join(',')}) REFERENCES ${targetTable}(${targetCols.join(',')})`
      });

      table.columns.forEach(col => {
        if (srcCols.includes(col.name)) {
          col.isForeignKey = true;
          col.references = { table: targetTable, column: targetCols[0] };
        }
      });
      continue;
    }

    // Unique key: UNIQUE [KEY|INDEX] [name] (cols)
    const uqMatch = trimmed.match(/^(?:CONSTRAINT\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+)?UNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?)?\s*\(([^)]+)\)/i);
    if (uqMatch) {
      const name = cleanIdentifier(uqMatch[2] || uqMatch[1] || `${table.name}_unique`);
      const cols = uqMatch[3].split(',').map(s => cleanIdentifier(s));
      table.uniqueConstraints.push(cols);
      table.indexes.push({
        name,
        columns: cols,
        unique: true,
        type: 'btree'
      });
      continue;
    }

    // Normal Key / Index: KEY|INDEX [name] (cols)
    const idxMatch = trimmed.match(/^(?:KEY|INDEX)\s+(?:[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s*)?\(([^)]+)\)/i);
    if (idxMatch) {
      const name = cleanIdentifier(idxMatch[1] || `${table.name}_idx`);
      const cols = idxMatch[2].split(',').map(s => cleanIdentifier(s));
      table.indexes.push({
        name,
        columns: cols,
        unique: false,
        type: 'btree'
      });
      continue;
    }

    // CHECK constraint
    const checkMatch = trimmed.match(/^CHECK\s*\(([\s\S]+)\)/i);
    if (checkMatch) {
      table.checks.push(checkMatch[1].trim());
      continue;
    }

    // Column definition: `col_name` TYPE [NULL|NOT NULL] [DEFAULT ...] [AUTO_INCREMENT] [PRIMARY KEY] [COMMENT '...']
    const colMatch = trimmed.match(/^[`"'\[]?([a-zA-Z0-9_]+)[`"'\]]?\s+([a-zA-Z0-9_]+(?:\s*\([^)]*\))?(?:\s+unsigned)?)([\s\S]*)$/i);
    if (colMatch) {
      const colName = cleanIdentifier(colMatch[1]);
      const rawType = colMatch[2].trim();
      const rest = colMatch[3].trim();

      const { type, nativeType, length, precision, scale, unsigned } = normalizeDataType(rawType);

      const isNullable = !/\bNOT\s+NULL\b/i.test(rest);
      const isAutoIncrement = /\b(AUTO_INCREMENT|SERIAL|BIGSERIAL|AUTOINCREMENT|IDENTITY)\b/i.test(rawType + ' ' + rest);
      const isInlinePk = /\bPRIMARY\s+KEY\b/i.test(rest);
      const isInlineUnique = /\bUNIQUE\b/i.test(rest);

      let defaultValue: string | null = null;
      const defaultMatch = rest.match(/\bDEFAULT\s+('([^']*)'|"([^"]*)"|NULL|[a-zA-Z0-9_()]+)/i);
      if (defaultMatch) {
        defaultValue = defaultMatch[2] ?? defaultMatch[3] ?? defaultMatch[1];
        if (defaultValue.toUpperCase() === 'NULL') defaultValue = null;
      }

      let comment: string | null = null;
      const commentMatch = rest.match(/\bCOMMENT\s+'([^']*)'/i);
      if (commentMatch) {
        comment = commentMatch[1];
      }

      const column: ColumnDefinition = {
        name: colName,
        type,
        nativeType,
        nullable: isNullable,
        default: defaultValue,
        autoIncrement: isAutoIncrement,
        unsigned,
        length,
        precision,
        scale,
        comment,
        isPrimaryKey: isInlinePk
      };

      if (isInlinePk && !table.primaryKey.includes(colName)) {
        table.primaryKey.push(colName);
      }

      if (isInlineUnique) {
        table.uniqueConstraints.push([colName]);
      }

      table.columns.push(column);
    } else {
      warnings.push({
        id: `warn-unparsed-${table.name}-${Date.now()}`,
        code: 'UNSUPPORTED_SQL_STATEMENT',
        message: `Unrecognized definition in table '${table.name}': ${trimmed}`,
        severity: 'notice',
        table: table.name,
        file: filename,
        suggestion: 'Review this constraint manually if required.'
      });
    }
  }
}

function splitCsvValues(csv: string): any[] {
  const result: any[] = [];
  let cur = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if ((c === "'" || c === '"') && (i === 0 || csv[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = c;
      } else if (quoteChar === c) {
        inQuotes = false;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cleanRawVal(cur.trim()));
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) {
    result.push(cleanRawVal(cur.trim()));
  }
  return result;
}

function cleanRawVal(val: string): any {
  if (val.toUpperCase() === 'NULL') return null;
  if (/^'[\s\S]*'$/.test(val) || /^"[\s\S]*"$/.test(val)) {
    return val.slice(1, -1);
  }
  if (!isNaN(Number(val))) {
    return Number(val);
  }
  if (/^(true|false)$/i.test(val)) {
    return val.toLowerCase() === 'true';
  }
  return val;
}

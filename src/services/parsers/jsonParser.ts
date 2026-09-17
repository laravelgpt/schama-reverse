import {
  AnalysisFinding,
  ColumnDefinition,
  ForeignKeyDefinition,
  TableDefinition
} from '../../types/schema';

function inferValueType(val: any): {
  type: string;
  nativeType: string;
  isDate: boolean;
  isUuid: boolean;
  isEmail: boolean;
} {
  if (val === null || val === undefined) {
    return { type: 'string', nativeType: 'VARCHAR(255)', isDate: false, isUuid: false, isEmail: false };
  }

  if (typeof val === 'boolean') {
    return { type: 'boolean', nativeType: 'BOOLEAN', isDate: false, isUuid: false, isEmail: false };
  }

  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      if (val > 2147483647 || val < -2147483648) {
        return { type: 'bigint', nativeType: 'BIGINT', isDate: false, isUuid: false, isEmail: false };
      }
      return { type: 'integer', nativeType: 'INTEGER', isDate: false, isUuid: false, isEmail: false };
    }
    return { type: 'decimal', nativeType: 'DECIMAL(10,2)', isDate: false, isUuid: false, isEmail: false };
  }

  if (typeof val === 'string') {
    // Check UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)) {
      return { type: 'uuid', nativeType: 'UUID', isDate: false, isUuid: true, isEmail: false };
    }
    // Check ISO Date
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(val)) {
      return { type: 'datetime', nativeType: 'TIMESTAMP', isDate: true, isUuid: false, isEmail: false };
    }
    // Check Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return { type: 'string', nativeType: 'VARCHAR(255)', isDate: false, isUuid: false, isEmail: true };
    }
    if (val.length > 255) {
      return { type: 'text', nativeType: 'TEXT', isDate: false, isUuid: false, isEmail: false };
    }
    return { type: 'string', nativeType: 'VARCHAR(255)', isDate: false, isUuid: false, isEmail: false };
  }

  if (Array.isArray(val) || typeof val === 'object') {
    return { type: 'json', nativeType: 'JSON', isDate: false, isUuid: false, isEmail: false };
  }

  return { type: 'string', nativeType: 'VARCHAR(255)', isDate: false, isUuid: false, isEmail: false };
}

export function parseJson(
  jsonString: string,
  filename = 'data.json'
): {
  tables: TableDefinition[];
  warnings: AnalysisFinding[];
} {
  const warnings: AnalysisFinding[] = [];
  let parsedData: any;

  try {
    parsedData = JSON.parse(jsonString);
  } catch (err: any) {
    warnings.push({
      id: `err-json-${Date.now()}`,
      code: 'INVALID_JSON_SYNTAX',
      message: `Failed to parse JSON file '${filename}': ${err.message}`,
      severity: 'error',
      file: filename
    });
    return { tables: [], warnings };
  }

  const tables: TableDefinition[] = [];
  const baseName = filename.replace(/\.[^/.]+$/, '').toLowerCase();

  // Case 1: Array of records -> single table
  if (Array.isArray(parsedData)) {
    const table = inferTableFromRecords(baseName, parsedData, filename, warnings);
    if (table) tables.push(table);
  }
  // Case 2: Object containing arrays -> multiple tables { users: [...], orders: [...] }
  else if (typeof parsedData === 'object' && parsedData !== null) {
    const keys = Object.keys(parsedData);
    let hasArrayKey = false;

    for (const key of keys) {
      const val = parsedData[key];
      if (Array.isArray(val)) {
        hasArrayKey = true;
        const table = inferTableFromRecords(key, val, filename, warnings);
        if (table) tables.push(table);
      }
    }

    // Case 3: Single nested object -> wrap into array or extract nested entities
    if (!hasArrayKey) {
      const table = inferTableFromRecords(baseName, [parsedData], filename, warnings);
      if (table) tables.push(table);
    }
  }

  return { tables, warnings };
}

function inferTableFromRecords(
  tableName: string,
  records: any[],
  filename: string,
  warnings: AnalysisFinding[]
): TableDefinition | null {
  if (!records.length) {
    return {
      name: tableName,
      columns: [
        {
          name: 'id',
          type: 'bigint',
          nativeType: 'BIGINT',
          nullable: false,
          default: null,
          autoIncrement: true,
          isPrimaryKey: true
        }
      ],
      primaryKey: ['id'],
      foreignKeys: [],
      indexes: [],
      uniqueConstraints: [],
      checks: [],
      sampleRows: [],
      rowCountEstimate: 0
    };
  }

  const colStats = new Map<
    string,
    {
      types: Map<string, number>;
      nullable: boolean;
      nativeType: string;
      isDate: boolean;
      isUuid: boolean;
      isEmail: boolean;
      uniqueValues: Set<any>;
      totalPresent: number;
    }
  >();

  const totalRows = records.length;

  for (const row of records) {
    if (typeof row !== 'object' || row === null) continue;

    for (const key of Object.keys(row)) {
      const val = row[key];
      let stat = colStats.get(key);
      if (!stat) {
        stat = {
          types: new Map(),
          nullable: false,
          nativeType: 'VARCHAR(255)',
          isDate: false,
          isUuid: false,
          isEmail: false,
          uniqueValues: new Set(),
          totalPresent: 0
        };
        colStats.set(key, stat);
      }

      stat.totalPresent++;
      if (val === null || val === undefined) {
        stat.nullable = true;
      } else {
        const inferred = inferValueType(val);
        stat.types.set(inferred.type, (stat.types.get(inferred.type) || 0) + 1);
        stat.nativeType = inferred.nativeType;
        if (inferred.isDate) stat.isDate = true;
        if (inferred.isUuid) stat.isUuid = true;
        if (inferred.isEmail) stat.isEmail = true;

        if (typeof val === 'string' || typeof val === 'number') {
          stat.uniqueValues.add(val);
        }
      }
    }
  }

  const columns: ColumnDefinition[] = [];
  const primaryKeys: string[] = [];
  const foreignKeys: ForeignKeyDefinition[] = [];
  const uniqueConstraints: string[][] = [];

  for (const [colName, stat] of colStats.entries()) {
    if (stat.totalPresent < totalRows) {
      stat.nullable = true;
    }

    // Pick dominant type
    let dominantType = 'string';
    let maxCount = 0;
    for (const [t, count] of stat.types.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = t;
      }
    }

    const isPkCandidate = /^(id|_id|uuid)$/i.test(colName) || colName.toLowerCase() === `${tableName.toLowerCase()}_id`;
    const isUnique = stat.uniqueValues.size === totalRows && totalRows > 1;

    let isPk = false;
    if (isPkCandidate && (isUnique || totalRows <= 1)) {
      isPk = true;
      primaryKeys.push(colName);
    } else if (isUnique && primaryKeys.length === 0 && (dominantType === 'integer' || dominantType === 'bigint' || stat.isUuid)) {
      isPk = true;
      primaryKeys.push(colName);
    } else if (isUnique && stat.isEmail) {
      uniqueConstraints.push([colName]);
    }

    // Check potential foreign key: e.g. customer_id, user_id, order_id
    const fkMatch = colName.match(/^([a-zA-Z0-9_]+)_id$/i);
    if (fkMatch && !isPk) {
      const referencedTable = fkMatch[1].endsWith('s') ? fkMatch[1] : `${fkMatch[1]}s`;
      foreignKeys.push({
        table: tableName,
        columns: [colName],
        referencedTable,
        referencedColumns: ['id'],
        confidence: 'inferred',
        source: 'json_naming_convention',
        evidence: `Inferred from column name '${colName}' in JSON dataset with confidence 85%`
      });
    }

    columns.push({
      name: colName,
      type: dominantType,
      nativeType: stat.nativeType,
      nullable: stat.nullable,
      default: null,
      autoIncrement: isPk && (dominantType === 'integer' || dominantType === 'bigint'),
      isPrimaryKey: isPk,
      isForeignKey: foreignKeys.some(f => f.columns.includes(colName))
    });
  }

  // Ensure table has at least one primary key
  if (primaryKeys.length === 0) {
    warnings.push({
      id: `warn-json-nopk-${tableName}`,
      code: 'MISSING_PRIMARY_KEY',
      message: `Table '${tableName}' from JSON has no detected primary key`,
      severity: 'warning',
      table: tableName,
      file: filename,
      suggestion: 'SchemaForge will generate an auto-incrementing id column'
    });
  }

  return {
    name: tableName,
    columns,
    primaryKey: primaryKeys.length > 0 ? primaryKeys : ['id'],
    foreignKeys,
    indexes: uniqueConstraints.map(cols => ({
      name: `${tableName}_${cols.join('_')}_unique`,
      columns: cols,
      unique: true,
      type: 'btree'
    })),
    uniqueConstraints,
    checks: [],
    sampleRows: records.slice(0, 50),
    rowCountEstimate: totalRows
  };
}

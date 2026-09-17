export type DatabaseEngine = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite' | 'sqlserver' | 'json' | 'unknown';

export type RelationshipConfidence = 'authoritative' | 'inferred' | 'possible';

export type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export type FindingSeverity = 'critical' | 'error' | 'warning' | 'notice' | 'suggestion';

export interface ColumnDefinition {
  name: string;
  type: string;
  nativeType: string;
  nullable: boolean;
  default: string | null;
  autoIncrement?: boolean;
  unsigned?: boolean;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
  comment?: string | null;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface ForeignKeyDefinition {
  name?: string;
  table: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action';
  onUpdate?: 'cascade' | 'set null' | 'restrict' | 'no action';
  confidence: RelationshipConfidence;
  source: string;
  evidence?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'fulltext' | 'primary' | 'normal';
}

export interface TableDefinition {
  name: string;
  schema?: string;
  engine?: string;
  comment?: string | null;
  columns: ColumnDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  uniqueConstraints: string[][];
  checks: string[];
  sampleRows?: Record<string, any>[];
  rowCountEstimate?: number;
}

export interface RelationshipDefinition {
  id: string;
  sourceTable: string;
  sourceColumns: string[];
  targetTable: string;
  targetColumns: string[];
  type: RelationshipType;
  junctionTable?: string;
  confidence: RelationshipConfidence;
  evidence: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface AnalysisFinding {
  id: string;
  code: string;
  message: string;
  severity: FindingSeverity;
  table?: string;
  column?: string;
  file?: string;
  line?: number;
  suggestion?: string;
  userAccepted?: boolean;
}

export interface HealthMetric {
  label: string;
  value: string;
  score: number; // 0 to 100
  pass: boolean;
  explanation: string;
}

export interface SchemaHealth {
  overallScore: number;
  referentialIntegrity: number;
  indexCoverage: number;
  constraintCoverage: number;
  parserConfidence: number;
  metrics: HealthMetric[];
}

export interface CanonicalSchema {
  schemaVersion: string;
  database: {
    engine: DatabaseEngine;
    version?: string;
    charset?: string;
    collation?: string;
  };
  tables: TableDefinition[];
  relationships: RelationshipDefinition[];
  warnings: AnalysisFinding[];
  health: SchemaHealth;
  sourceFiles: {
    name: string;
    size: number;
    type: 'sql' | 'json' | 'zip';
  }[];
  generatedAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  schema?: CanonicalSchema;
}

export interface ImportState {
  id?: string;
  projectId?: string;
  status: 'idle' | 'uploading' | 'scanning' | 'parsing' | 'normalizing' | 'analyzing' | 'generating_erd' | 'completed' | 'failed' | 'error';
  sourceType?: string;
  databaseEngine?: DatabaseEngine;
  fileCount?: number;
  filesCount?: number;
  tableCount?: number;
  warningCount?: number;
  progress: number; // 0 - 100
  currentStep: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface GeneratedFile {
  path: string;
  filename: string;
  category: 'migration' | 'model' | 'factory' | 'seeder' | 'schema' | 'dbml' | 'mermaid' | 'manifest' | 'docs' | 'reports';
  content: string;
  language: 'php' | 'json' | 'sql' | 'markdown' | 'html' | 'text';
}

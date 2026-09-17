import {
  CanonicalSchema,
  ColumnDefinition,
  GeneratedFile,
  TableDefinition
} from '../../types/schema';

// Convert table name to Laravel Model Name (e.g. 'users' -> 'User', 'order_items' -> 'OrderItem')
export function tableToModelName(tableName: string): string {
  const singular = tableName.endsWith('ies')
    ? tableName.slice(0, -3) + 'y'
    : tableName.endsWith('es') && !tableName.endsWith('ses')
    ? tableName.slice(0, -2)
    : tableName.endsWith('s') && !tableName.endsWith('ss')
    ? tableName.slice(0, -1)
    : tableName;

  return singular
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Convert table name to camelCase relationship method name
export function tableToMethodName(tableName: string, plural = false): string {
  const modelName = tableToModelName(tableName);
  const base = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  if (plural) {
    return base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
  }
  return base;
}

// Map canonical type to Laravel migration column method
function mapColumnToLaravel(col: ColumnDefinition): string {
  if (col.isPrimaryKey && col.name === 'id') {
    if (col.type === 'uuid') {
      return "$table->uuid('id')->primary();";
    }
    return '$table->id();';
  }

  let line = '';
  switch (col.type) {
    case 'bigint':
      line = col.unsigned ? `$table->unsignedBigInteger('${col.name}')` : `$table->bigInteger('${col.name}')`;
      break;
    case 'integer':
      line = col.unsigned ? `$table->unsignedInteger('${col.name}')` : `$table->integer('${col.name}')`;
      break;
    case 'string':
      line = col.length ? `$table->string('${col.name}', ${col.length})` : `$table->string('${col.name}')`;
      break;
    case 'text':
      line = `$table->text('${col.name}')`;
      break;
    case 'boolean':
      line = `$table->boolean('${col.name}')`;
      break;
    case 'decimal':
      line = `$table->decimal('${col.name}', ${col.precision || 10}, ${col.scale || 2})`;
      break;
    case 'float':
      line = `$table->float('${col.name}')`;
      break;
    case 'datetime':
      line = `$table->dateTime('${col.name}')`;
      break;
    case 'date':
      line = `$table->date('${col.name}')`;
      break;
    case 'time':
      line = `$table->time('${col.name}')`;
      break;
    case 'uuid':
      line = `$table->uuid('${col.name}')`;
      break;
    case 'json':
      line = `$table->json('${col.name}')`;
      break;
    case 'binary':
      line = `$table->binary('${col.name}')`;
      break;
    default:
      line = `$table->string('${col.name}')`;
  }

  if (col.nullable) {
    line += '->nullable()';
  }

  if (col.default !== null && col.default !== undefined) {
    if (col.default.toLowerCase() === 'current_timestamp') {
      line += '->useCurrent()';
    } else if (!isNaN(Number(col.default))) {
      line += `->default(${col.default})`;
    } else if (col.default.toLowerCase() === 'true' || col.default.toLowerCase() === 'false') {
      line += `->default(${col.default.toLowerCase()})`;
    } else {
      line += `->default('${col.default}')`;
    }
  }

  if (col.comment) {
    line += `->comment('${col.comment.replace(/'/g, "\\'")}')`;
  }

  line += ';';
  return line;
}

// Topologically sort tables based on foreign key dependencies
export function orderTablesByDependency(tables: TableDefinition[]): {
  ordered: TableDefinition[];
  hasCircular: boolean;
} {
  const adj = new Map<string, Set<string>>();
  const tableMap = new Map<string, TableDefinition>();

  for (const t of tables) {
    adj.set(t.name.toLowerCase(), new Set());
    tableMap.set(t.name.toLowerCase(), t);
  }

  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      const target = fk.referencedTable.toLowerCase();
      if (target !== t.name.toLowerCase() && adj.has(target)) {
        // t depends on target => target must be migrated first
        adj.get(t.name.toLowerCase())!.add(target);
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];
  let hasCircular = false;

  function dfs(node: string) {
    if (visiting.has(node)) {
      hasCircular = true;
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    const deps = adj.get(node) || new Set();
    for (const dep of deps) {
      dfs(dep);
    }
    visiting.delete(node);
    visited.add(node);
    order.push(node);
  }

  for (const t of tables) {
    if (!visited.has(t.name.toLowerCase())) {
      dfs(t.name.toLowerCase());
    }
  }

  const orderedTables = order
    .map(name => tableMap.get(name))
    .filter((t): t is TableDefinition => t !== undefined);

  return { ordered: orderedTables, hasCircular };
}

export function generateLaravelFiles(schema: CanonicalSchema): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { ordered, hasCircular } = orderTablesByDependency(schema.tables);

  const baseTimestamp = 20260101000000;

  // 1. Migrations
  ordered.forEach((table, index) => {
    const timestampStr = String(baseTimestamp + index * 10);
    const filename = `${timestampStr}_create_${table.name}_table.php`;
    const path = `database/migrations/${filename}`;

    const migrationContent = generateMigrationCode(table, schema, hasCircular);
    files.push({
      path,
      filename,
      category: 'migration',
      content: migrationContent,
      language: 'php'
    });
  });

  // If circular dependencies existed, add a Phase 2 Migration for foreign keys
  if (hasCircular) {
    const phase2Timestamp = String(baseTimestamp + (ordered.length + 1) * 10);
    const p2Filename = `${phase2Timestamp}_add_foreign_keys_to_tables.php`;
    const p2Content = generatePhase2ForeignKeysMigration(ordered);
    files.push({
      path: `database/migrations/${p2Filename}`,
      filename: p2Filename,
      category: 'migration',
      content: p2Content,
      language: 'php'
    });
  }

  // 2. Eloquent Models (with latest Laravel 13 PHP 8 #[] attributes)
  for (const table of schema.tables) {
    const modelName = tableToModelName(table.name);
    const filename = `${modelName}.php`;
    const path = `app/Models/${filename}`;

    const modelContent = generateModelCode(table, schema);
    files.push({
      path,
      filename,
      category: 'model',
      content: modelContent,
      language: 'php'
    });
  }

  // 3. Eloquent Model Factories
  for (const table of schema.tables) {
    const modelName = tableToModelName(table.name);
    const filename = `${modelName}Factory.php`;
    const path = `database/factories/${filename}`;

    const factoryContent = generateModelFactoryCode(table);
    files.push({
      path,
      filename,
      category: 'factory',
      content: factoryContent,
      language: 'php'
    });
  }

  // 4. Database Seeders
  for (const table of schema.tables) {
    const modelName = tableToModelName(table.name);
    const filename = `${modelName}Seeder.php`;
    const path = `database/seeders/${filename}`;

    const seederContent = generateTableSeederCode(table);
    files.push({
      path,
      filename,
      category: 'seeder',
      content: seederContent,
      language: 'php'
    });
  }

  // Master DatabaseSeeder
  const masterSeederContent = generateMasterSeederCode(ordered);
  files.push({
    path: 'database/seeders/DatabaseSeeder.php',
    filename: 'DatabaseSeeder.php',
    category: 'seeder',
    content: masterSeederContent,
    language: 'php'
  });

  return files;
}

function generateMigrationCode(
  table: TableDefinition,
  schema: CanonicalSchema,
  delayFksToPhase2: boolean
): string {
  const lines: string[] = [];

  // Columns
  for (const col of table.columns) {
    lines.push(`            ${mapColumnToLaravel(col)}`);
  }

  // Multi-column Primary Key
  if (table.primaryKey.length > 1) {
    const pkList = table.primaryKey.map(c => `'${c}'`).join(', ');
    lines.push(`            $table->primary([${pkList}]);`);
  }

  // Unique constraints
  for (const uq of table.uniqueConstraints) {
    if (uq.length === 1 && table.primaryKey.includes(uq[0])) continue;
    const cols = uq.map(c => `'${c}'`).join(', ');
    lines.push(`            $table->unique([${cols}]);`);
  }

  // Indexes
  for (const idx of table.indexes) {
    if (idx.unique) continue; // already handled
    const cols = idx.columns.map(c => `'${c}'`).join(', ');
    lines.push(`            $table->index([${cols}], '${idx.name}');`);
  }

  // Inline Foreign Keys (only if not delaying due to circular dependencies)
  if (!delayFksToPhase2) {
    for (const fk of table.foreignKeys) {
      const srcCol = fk.columns[0];
      const targetTable = fk.referencedTable;
      const targetCol = fk.referencedColumns[0] || 'id';

      let fkLine = `            $table->foreign('${srcCol}')->references('${targetCol}')->on('${targetTable}')`;
      if (fk.onDelete) {
        fkLine += fk.onDelete === 'cascade' ? '->cascadeOnDelete()' : `->onDelete('${fk.onDelete}')`;
      }
      if (fk.onUpdate) {
        fkLine += `->onUpdate('${fk.onUpdate}')`;
      }
      fkLine += ';';
      lines.push(fkLine);
    }
  }

  // Check if timestamps are already present
  const hasCreated = table.columns.some(c => c.name === 'created_at');
  const hasUpdated = table.columns.some(c => c.name === 'updated_at');
  if (!hasCreated && !hasUpdated) {
    lines.push('            $table->timestamps();');
  }

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${table.name}', function (Blueprint $table) {
${lines.join('\n')}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${table.name}');
    }
};
`;
}

function generatePhase2ForeignKeysMigration(tables: TableDefinition[]): string {
  const upBlocks: string[] = [];
  const downBlocks: string[] = [];

  for (const table of tables) {
    if (table.foreignKeys.length === 0) continue;

    const upLines: string[] = [];
    const downLines: string[] = [];

    for (const fk of table.foreignKeys) {
      const srcCol = fk.columns[0];
      const targetTable = fk.referencedTable;
      const targetCol = fk.referencedColumns[0] || 'id';

      let line = `            $table->foreign('${srcCol}')->references('${targetCol}')->on('${targetTable}')`;
      if (fk.onDelete) {
        line += fk.onDelete === 'cascade' ? '->cascadeOnDelete()' : `->onDelete('${fk.onDelete}')`;
      }
      line += ';';
      upLines.push(line);
      downLines.push(`            $table->dropForeign(['${srcCol}']);`);
    }

    upBlocks.push(`        Schema::table('${table.name}', function (Blueprint $table) {\n${upLines.join('\n')}\n        });`);
    downBlocks.push(`        Schema::table('${table.name}', function (Blueprint $table) {\n${downLines.join('\n')}\n        });`);
  }

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run Phase 2 Foreign Key constraints to resolve circular dependencies.
     */
    public function up(): void
    {
${upBlocks.join('\n\n')}
    }

    /**
     * Reverse foreign key constraints.
     */
    public function down(): void
    {
${downBlocks.join('\n\n')}
    }
};
`;
}

function generateModelCode(table: TableDefinition, schema: CanonicalSchema): string {
  const modelName = tableToModelName(table.name);
  const factoryClass = `${modelName}Factory`;

  // Determine Primary Key configuration
  const pkCols = table.primaryKey;
  const singlePk = pkCols.length === 1 ? pkCols[0] : null;
  const pkColDef = singlePk ? table.columns.find(c => c.name === singlePk) : null;
  const isCustomPk = singlePk && singlePk !== 'id';
  const isUuidPk = pkColDef && (pkColDef.type === 'uuid' || (singlePk ? singlePk.toLowerCase().includes('uuid') : false));

  // Timestamps check
  const hasCreated = table.columns.some(c => c.name === 'created_at');
  const hasUpdated = table.columns.some(c => c.name === 'updated_at');
  const hasTimestamps = hasCreated && hasUpdated;

  // Build #[Table] attribute parameters
  const tableAttrParams: string[] = [`name: '${table.name}'`];
  if (isCustomPk) {
    tableAttrParams.push(`key: '${singlePk}'`);
  }
  if (isUuidPk || (pkColDef && !pkColDef.autoIncrement && pkColDef.type !== 'bigint' && pkColDef.type !== 'integer')) {
    tableAttrParams.push(`incrementing: false`);
    if (pkColDef?.type === 'string' || pkColDef?.type === 'uuid') {
      tableAttrParams.push(`keyType: 'string'`);
    }
  }

  // Attributes list above class
  const classAttributes: string[] = [
    `#[Table(${tableAttrParams.join(', ')})]`,
    `#[UseFactory(${factoryClass}::class)]`
  ];

  if (!hasTimestamps) {
    classAttributes.push(`#[WithoutTimestamps]`);
  }

  // Fillable: exclude primary key and timestamps
  const fillable = table.columns
    .filter(c => !table.primaryKey.includes(c.name) && c.name !== 'created_at' && c.name !== 'updated_at')
    .map(c => `        '${c.name}',`);

  // Casts for casts() method
  const casts: string[] = [];
  for (const col of table.columns) {
    if (col.type === 'boolean') {
      casts.push(`            '${col.name}' => 'boolean',`);
    } else if (col.type === 'datetime') {
      casts.push(`            '${col.name}' => 'datetime',`);
    } else if (col.type === 'date') {
      casts.push(`            '${col.name}' => 'date',`);
    } else if (col.type === 'json') {
      casts.push(`            '${col.name}' => 'array',`);
    } else if (col.type === 'decimal') {
      casts.push(`            '${col.name}' => 'decimal:${col.scale || 2}',`);
    } else if (col.name.toLowerCase().includes('password') || col.name.toLowerCase().includes('token')) {
      casts.push(`            '${col.name}' => 'hashed',`);
    }
  }

  // Relationship methods
  const methods: string[] = [];
  const relations = schema.relationships.filter(
    r => r.sourceTable.toLowerCase() === table.name.toLowerCase() ||
         r.targetTable.toLowerCase() === table.name.toLowerCase()
  );

  let hasBelongsTo = false;
  let hasHasMany = false;
  let hasBelongsToMany = false;

  for (const rel of relations) {
    // 1. BelongsTo: this table is the child (holds foreign key)
    if (rel.sourceTable.toLowerCase() === table.name.toLowerCase() && rel.type !== 'many-to-many') {
      hasBelongsTo = true;
      const targetModel = tableToModelName(rel.targetTable);
      const methodName = tableToMethodName(rel.targetTable, false);
      methods.push(`    /**
     * Get the associated ${targetModel}.
     */
    public function ${methodName}(): BelongsTo
    {
        return $this->belongsTo(${targetModel}::class, '${rel.sourceColumns[0]}', '${rel.targetColumns[0]}');
    }`);
    }

    // 2. HasMany: this table is the parent
    if (rel.targetTable.toLowerCase() === table.name.toLowerCase() && rel.type === 'many-to-one') {
      hasHasMany = true;
      const childModel = tableToModelName(rel.sourceTable);
      const methodName = tableToMethodName(rel.sourceTable, true);
      methods.push(`    /**
     * Get the related ${childModel} records.
     */
    public function ${methodName}(): HasMany
    {
        return $this->hasMany(${childModel}::class, '${rel.sourceColumns[0]}', '${rel.targetColumns[0]}');
    }`);
    }

    // 3. BelongsToMany (Many-to-Many junction)
    if (rel.type === 'many-to-many') {
      const isA = rel.sourceTable.toLowerCase() === table.name.toLowerCase();
      const isB = rel.targetTable.toLowerCase() === table.name.toLowerCase();
      if (isA || isB) {
        hasBelongsToMany = true;
        const otherTable = isA ? rel.targetTable : rel.sourceTable;
        const otherModel = tableToModelName(otherTable);
        const methodName = tableToMethodName(otherTable, true);
        methods.push(`    /**
     * The ${methodName} that belong to this ${modelName}.
     */
    public function ${methodName}(): BelongsToMany
    {
        return $this->belongsToMany(${otherModel}::class, '${rel.junctionTable}');
    }`);
      }
    }
  }

  // Scopes using modern #[Scope] attribute
  const scopes: string[] = [];
  const statusCol = table.columns.find(c => c.name.toLowerCase() === 'status' || c.name.toLowerCase() === 'is_active');
  if (statusCol) {
    if (statusCol.type === 'boolean') {
      scopes.push(`    /**
     * Scope a query to only include active records.
     */
    #[Scope]
    public function active(Builder $query): void
    {
        $query->where('${statusCol.name}', true);
    }`);
    } else {
      scopes.push(`    /**
     * Scope a query to only include active records.
     */
    #[Scope]
    public function active(Builder $query): void
    {
        $query->where('${statusCol.name}', 'active');
    }`);
    }
  }

  if (hasCreated) {
    scopes.push(`    /**
     * Scope a query to order by latest records first.
     */
    #[Scope]
    public function latestFirst(Builder $query): void
    {
        $query->latest('created_at');
    }`);
  }

  const relationImports: string[] = [];
  if (hasBelongsTo) relationImports.push('use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;');
  if (hasHasMany) relationImports.push('use Illuminate\\Database\\Eloquent\\Relations\\HasMany;');
  if (hasBelongsToMany) relationImports.push('use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;');

  return `<?php

namespace App\\Models;

use Database\\Factories\\${factoryClass};
use Illuminate\\Database\\Eloquent\\Attributes\\Table;
use Illuminate\\Database\\Eloquent\\Attributes\\UseFactory;
use Illuminate\\Database\\Eloquent\\Attributes\\Scope;
${!hasTimestamps ? "use Illuminate\\Database\\Eloquent\\Attributes\\WithoutTimestamps;\n" : ''}use Illuminate\\Database\\Eloquent\\Builder;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
${relationImports.join('\n')}${relationImports.length > 0 ? '\n' : ''}
${classAttributes.join('\n')}
class ${modelName} extends Model
{
    /** @use HasFactory<${factoryClass}> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
${fillable.join('\n')}
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
${casts.join('\n')}
        ];
    }
${scopes.length > 0 ? '\n' + scopes.join('\n\n') : ''}
${methods.length > 0 ? '\n' + methods.join('\n\n') : ''}
}
`;
}

function generateModelFactoryCode(table: TableDefinition): string {
  const modelName = tableToModelName(table.name);
  const defs: string[] = [];

  for (const col of table.columns) {
    if (table.primaryKey.includes(col.name) && (col.type === 'bigint' || col.type === 'integer') && col.autoIncrement) {
      continue; // auto-incrementing integer PK
    }
    if (col.name === 'created_at' || col.name === 'updated_at') {
      continue;
    }

    let fakeExpr = 'fake()->word()';
    const nameLower = col.name.toLowerCase();

    if (col.type === 'uuid' || nameLower.includes('uuid')) {
      fakeExpr = 'fake()->uuid()';
    } else if (nameLower === 'email' || nameLower.includes('email')) {
      fakeExpr = 'fake()->unique()->safeEmail()';
    } else if (nameLower === 'name' || nameLower === 'full_name') {
      fakeExpr = 'fake()->name()';
    } else if (nameLower === 'first_name') {
      fakeExpr = 'fake()->firstName()';
    } else if (nameLower === 'last_name') {
      fakeExpr = 'fake()->lastName()';
    } else if (nameLower === 'title') {
      fakeExpr = 'fake()->sentence(4)';
    } else if (nameLower === 'description' || nameLower === 'bio' || nameLower === 'content' || col.type === 'text') {
      fakeExpr = 'fake()->paragraph()';
    } else if (nameLower === 'password') {
      fakeExpr = "bcrypt('password')";
    } else if (nameLower.includes('phone')) {
      fakeExpr = 'fake()->phoneNumber()';
    } else if (nameLower.includes('address')) {
      fakeExpr = 'fake()->address()';
    } else if (nameLower.includes('city')) {
      fakeExpr = 'fake()->city()';
    } else if (nameLower.includes('country')) {
      fakeExpr = 'fake()->country()';
    } else if (nameLower.includes('postal') || nameLower.includes('zip')) {
      fakeExpr = 'fake()->postcode()';
    } else if (nameLower.includes('price') || nameLower.includes('amount') || nameLower.includes('total') || col.type === 'decimal') {
      fakeExpr = 'fake()->randomFloat(2, 10, 1000)';
    } else if (col.type === 'boolean') {
      fakeExpr = 'fake()->boolean(80)';
    } else if (col.type === 'datetime') {
      fakeExpr = 'fake()->dateTimeBetween("-1 year", "now")';
    } else if (col.type === 'date') {
      fakeExpr = 'fake()->date()';
    } else if (col.type === 'integer' || col.type === 'bigint') {
      if (nameLower.endsWith('_id')) {
        fakeExpr = '1';
      } else {
        fakeExpr = 'fake()->numberBetween(1, 100)';
      }
    } else if (col.type === 'json') {
      fakeExpr = "['tier' => 'standard', 'tags' => ['verified']]";
    }

    defs.push(`            '${col.name}' => ${fakeExpr},`);
  }

  return `<?php

namespace Database\\Factories;

use App\\Models\\${modelName};
use Illuminate\\Database\\Eloquent\\Factories\\Factory;

/**
 * @extends \\Illuminate\\Database\\Eloquent\\Factories\\Factory<\\App\\Models\\${modelName}>
 */
class ${modelName}Factory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\\App\\Models\\${modelName}>
     */
    protected $model = ${modelName}::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
${defs.join('\n')}
        ];
    }
}
`;
}

function generateTableSeederCode(table: TableDefinition): string {
  const modelName = tableToModelName(table.name);
  const rows = table.sampleRows || [];

  let insertCode = '';
  if (rows.length > 0) {
    const formattedRows = rows.slice(0, 50).map(row => {
      const entries = Object.entries(row)
        .map(([k, v]) => {
          const valStr = v === null ? 'null' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "\\'")}'`;
          return `'${k}' => ${valStr}`;
        })
        .join(', ');
      return `            [${entries}],`;
    });

    insertCode = `        DB::table('${table.name}')->insert([
${formattedRows.join('\n')}
        ]);`;
  } else {
    insertCode = `        // Sample records: no INSERT statements detected in source dump
        DB::table('${table.name}')->insert([
            // ['name' => 'Demo Record'],
        ]);`;
  }

  return `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use Illuminate\\Support\\Facades\\DB;

class ${modelName}Seeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
${insertCode}
    }
}
`;
}

function generateMasterSeederCode(tables: TableDefinition[]): string {
  const seederCalls = tables.map(t => `            ${tableToModelName(t.name)}Seeder::class,`);

  return `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
${seederCalls.join('\n')}
        ]);
    }
}
`;
}

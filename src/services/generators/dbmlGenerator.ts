import { CanonicalSchema, GeneratedFile } from '../../types/schema';

export function generateDbml(schema: CanonicalSchema): GeneratedFile {
  const lines: string[] = [
    `// SchemaForge Generated DBML Specification`,
    `// Database Engine: ${schema.database.engine.toUpperCase()}`,
    `// Generated: ${schema.generatedAt}`,
    ``
  ];

  for (const table of schema.tables) {
    lines.push(`Table ${table.name} {`);
    for (const col of table.columns) {
      const parts: string[] = [];
      if (col.isPrimaryKey) parts.push('pk');
      if (!col.nullable) parts.push('not null');
      const isUnique = table.uniqueConstraints.some(uq => uq.length === 1 && uq[0] === col.name);
      if (isUnique) parts.push('unique');
      if (col.autoIncrement) parts.push('increment');
      if (col.default !== null) parts.push(`default: "${col.default}"`);

      const settings = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
      lines.push(`  ${col.name} ${col.type}${settings}`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Relationships
  for (const rel of schema.relationships) {
    if (rel.type === 'many-to-many') continue;
    const operator = rel.type === 'one-to-one' ? '-' : '>';
    lines.push(`Ref: ${rel.sourceTable}.${rel.sourceColumns[0]} ${operator} ${rel.targetTable}.${rel.targetColumns[0]}`);
  }

  return {
    path: 'schema/schema.dbml',
    filename: 'schema.dbml',
    category: 'dbml',
    content: lines.join('\n'),
    language: 'sql'
  };
}

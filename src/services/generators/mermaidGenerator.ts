import { CanonicalSchema, GeneratedFile } from '../../types/schema';

export function generateMermaid(schema: CanonicalSchema): GeneratedFile {
  const lines: string[] = ['erDiagram'];

  // Entities with attributes
  for (const table of schema.tables) {
    lines.push(`    ${table.name.toUpperCase()} {`);
    for (const col of table.columns) {
      let keyFlag = '';
      if (col.isPrimaryKey) keyFlag = ' PK';
      else if (col.isForeignKey) keyFlag = ' FK';
      lines.push(`        ${col.type} ${col.name}${keyFlag}`);
    }
    lines.push(`    }`);
  }

  // Relationships with cardinality
  for (const rel of schema.relationships) {
    if (rel.type === 'many-to-many') {
      lines.push(`    ${rel.sourceTable.toUpperCase()} }|--|{ ${rel.targetTable.toUpperCase()} : "via ${rel.junctionTable || 'junction'}"`);
    } else if (rel.type === 'one-to-one') {
      lines.push(`    ${rel.targetTable.toUpperCase()} ||--|| ${rel.sourceTable.toUpperCase()} : "has"`);
    } else {
      lines.push(`    ${rel.targetTable.toUpperCase()} ||--o{ ${rel.sourceTable.toUpperCase()} : "has"`);
    }
  }

  return {
    path: 'schema/erd.mermaid',
    filename: 'erd.mermaid',
    category: 'mermaid',
    content: lines.join('\n'),
    language: 'markdown'
  };
}

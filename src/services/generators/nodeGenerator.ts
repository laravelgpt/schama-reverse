import { CanonicalSchema, GeneratedFile } from '../../types/schema';

export function generateNodeFiles(schema: CanonicalSchema): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. schema.json
  files.push({
    path: 'node/schema.json',
    filename: 'schema.json',
    category: 'schema',
    content: JSON.stringify(schema, null, 2),
    language: 'json'
  });

  // 2. Individual table JSONs
  for (const table of schema.tables) {
    files.push({
      path: `node/tables/${table.name}.json`,
      filename: `${table.name}.json`,
      category: 'schema',
      content: JSON.stringify(table, null, 2),
      language: 'json'
    });
  }

  // 3. relationships.json
  files.push({
    path: 'node/relationships.json',
    filename: 'relationships.json',
    category: 'schema',
    content: JSON.stringify(schema.relationships, null, 2),
    language: 'json'
  });

  return files;
}

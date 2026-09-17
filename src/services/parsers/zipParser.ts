import JSZip from 'jszip';
import { AnalysisFinding, DatabaseEngine, TableDefinition } from '../../types/schema';
import { parseSql } from './sqlParser';
import { parseJson } from './jsonParser';

export interface UnpackedFile {
  name: string;
  size: number;
  type: 'sql' | 'json' | 'zip' | 'unsupported';
  content: string;
}

export async function unpackZipFile(fileBuffer: ArrayBuffer | Blob): Promise<UnpackedFile[]> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(fileBuffer);
  const results: UnpackedFile[] = [];

  const filePromises: Promise<void>[] = [];

  loaded.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    // Ignore MacOS junk files or system dotfiles
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) {
      return;
    }

    const lower = relativePath.toLowerCase();
    let type: 'sql' | 'json' | 'zip' | 'unsupported' = 'unsupported';

    if (lower.endsWith('.sql')) {
      type = 'sql';
    } else if (lower.endsWith('.json')) {
      type = 'json';
    } else if (lower.endsWith('.zip')) {
      type = 'zip';
    }

    if (type !== 'unsupported') {
      const p = zipEntry.async('string').then(text => {
        results.push({
          name: relativePath,
          size: text.length,
          type,
          content: text
        });
      });
      filePromises.push(p);
    }
  });

  await Promise.all(filePromises);
  return results;
}

export function mergeParsedSchemas(
  fileOutputs: {
    filename: string;
    tables: TableDefinition[];
    warnings: AnalysisFinding[];
    engine?: DatabaseEngine;
  }[]
): {
  tables: TableDefinition[];
  warnings: AnalysisFinding[];
  engine: DatabaseEngine;
} {
  const tableMap = new Map<string, TableDefinition>();
  const allWarnings: AnalysisFinding[] = [];
  let detectedEngine: DatabaseEngine = 'mysql';

  for (const out of fileOutputs) {
    if (out.engine && out.engine !== 'unknown') {
      detectedEngine = out.engine;
    }
    allWarnings.push(...out.warnings);

    for (const table of out.tables) {
      if (!tableMap.has(table.name)) {
        tableMap.set(table.name, { ...table });
      } else {
        // Handle duplicate table definition across files
        allWarnings.push({
          id: `warn-dup-file-${table.name}-${out.filename}`,
          code: 'DUPLICATE_SCHEMA_DEFINITION',
          message: `Table '${table.name}' defined in multiple files (including ${out.filename}).`,
          severity: 'warning',
          table: table.name,
          file: out.filename,
          suggestion: 'Merging columns and foreign keys; verify if this was intended.'
        });

        const existing = tableMap.get(table.name)!;

        // Merge columns not yet in existing
        for (const col of table.columns) {
          if (!existing.columns.some(c => c.name === col.name)) {
            existing.columns.push(col);
          }
        }

        // Merge foreign keys
        for (const fk of table.foreignKeys) {
          const exists = existing.foreignKeys.some(
            efk => efk.referencedTable === fk.referencedTable && efk.columns.join(',') === fk.columns.join(',')
          );
          if (!exists) {
            existing.foreignKeys.push(fk);
          }
        }

        // Merge sample rows
        if (table.sampleRows && table.sampleRows.length > 0) {
          existing.sampleRows = [...(existing.sampleRows || []), ...table.sampleRows].slice(0, 100);
        }
      }
    }
  }

  return {
    tables: Array.from(tableMap.values()),
    warnings: allWarnings,
    engine: detectedEngine
  };
}

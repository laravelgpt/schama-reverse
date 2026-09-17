import { CanonicalSchema } from '../../types/schema';

/**
 * Generates a self-contained, interactive HTML Data Dictionary and Architecture Report
 * that can be opened in any web browser completely offline.
 */
export function generateHtmlReport(schema: CanonicalSchema): string {
  const generatedDate = new Date().toUTCString();
  const overallScore = schema.health.overallScore;

  // Escape HTML helper
  const esc = (str: string | null | undefined) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchemaForge Data Dictionary - ${esc(schema.database.engine.toUpperCase())} Database</title>
  <style>
    :root {
      --bg: #030712;
      --card-bg: #0f172a;
      --card-header: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --cyan: #38bdf8;
      --amber: #fbbf24;
      --emerald: #34d399;
      --purple: #c084fc;
      --rose: #fb7185;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-engine { background: rgba(56, 189, 248, 0.15); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-score { background: rgba(52, 211, 153, 0.15); color: var(--emerald); border: 1px solid rgba(52, 211, 153, 0.3); }
    .badge-pk { background: rgba(251, 191, 36, 0.15); color: var(--amber); border: 1px solid rgba(251, 191, 36, 0.3); }
    .badge-fk { background: rgba(56, 189, 248, 0.15); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-warn { background: rgba(251, 113, 133, 0.15); color: var(--rose); border: 1px solid rgba(251, 113, 133, 0.3); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .stat-val { font-size: 24px; font-weight: 800; font-family: monospace; color: var(--cyan); }

    .search-bar {
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
    }
    .search-input {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    .search-input:focus { border-color: var(--cyan); }

    .table-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .table-header {
      background: var(--card-header);
      padding: 14px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--border);
    }
    .table-title { font-size: 16px; font-weight: 700; font-family: monospace; color: var(--cyan); }
    .table-desc { font-size: 12px; color: var(--text-muted); font-style: italic; }

    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { background: rgba(15, 23, 42, 0.6); padding: 10px 16px; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); }
    td { padding: 10px 16px; border-bottom: 1px solid rgba(51, 65, 85, 0.4); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(30, 41, 59, 0.4); }

    .col-name { font-family: monospace; font-weight: 600; }
    .col-type { font-family: monospace; color: var(--text-muted); }
    .col-constraint { font-family: monospace; font-size: 11px; }

    .rel-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 32px;
    }
    .rel-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-family: monospace;
      font-size: 13px;
    }
    .rel-item:last-child { border-bottom: none; }
    .arrow { color: var(--text-muted); }

    .btn-print {
      padding: 8px 16px;
      background: var(--cyan);
      color: #020617;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      transition: opacity 0.2s;
    }
    .btn-print:hover { opacity: 0.9; }

    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .search-bar, .btn-print { display: none; }
      .table-section, .stat-card, .rel-section {
        background: #fff;
        border: 1px solid #ccc;
        color: #000;
        page-break-inside: avoid;
      }
      .table-header { background: #f1f5f9; color: #000; }
      .table-title { color: #0369a1; }
      th { background: #f8fafc; color: #334155; }
      td { border-bottom: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">SchemaForge Data Dictionary</h1>
          <p style="font-size: 12px; color: var(--text-muted);">Generated on ${esc(generatedDate)}</p>
        </div>
        <span class="badge badge-engine">${esc(schema.database.engine)}</span>
        <span class="badge badge-score">${overallScore}% Health</span>
      </div>
      <div>
        <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Tables</div>
        <div class="stat-val">${schema.tables.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Relationships</div>
        <div class="stat-val">${schema.relationships.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Overall Health Score</div>
        <div class="stat-val">${overallScore}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Diagnostics</div>
        <div class="stat-val">${schema.warnings.length}</div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-bar">
      <input type="text" id="filterInput" class="search-input" placeholder="Search tables or columns..." onkeyup="filterTables()">
    </div>

    <!-- Relationships Summary -->
    <div class="rel-section">
      <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--cyan);">Relational Foreign Key Graph</h2>
      ${schema.relationships.length === 0 ? '<p style="color: var(--text-muted); font-size: 13px;">No explicit or inferred foreign key relationships detected.</p>' : ''}
      ${schema.relationships.map(rel => `
        <div class="rel-item">
          <span style="color: var(--cyan); font-weight: 700;">${esc(rel.sourceTable)}.${esc(rel.sourceColumns.join(','))}</span>
          <span class="arrow">&rarr;</span>
          <span style="color: var(--amber); font-weight: 700;">${esc(rel.targetTable)}.${esc(rel.targetColumns.join(','))}</span>
          <span class="badge ${rel.confidence === 'authoritative' ? 'badge-engine' : 'badge-pk'}">${esc(rel.confidence)}</span>
          <span style="color: var(--text-muted); font-size: 11px;">Type: ${esc(rel.type)}</span>
          ${rel.junctionTable ? `<span class="badge badge-fk">Junction: ${esc(rel.junctionTable)}</span>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Data Dictionary Tables -->
    <div id="tablesContainer">
      ${schema.tables.map(table => `
        <div class="table-section" data-table="${esc(table.name.toLowerCase())}">
          <div class="table-header">
            <div>
              <div class="table-title">${esc(table.name)}</div>
              ${table.comment ? `<div class="table-desc">${esc(table.comment)}</div>` : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">
              ${table.columns.length} columns &bull; ${table.indexes.length} indexes
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Column Name</th>
                <th style="width: 20%;">Type</th>
                <th style="width: 12%;">Nullable</th>
                <th style="width: 18%;">Default</th>
                <th style="width: 25%;">Keys & Constraints</th>
              </tr>
            </thead>
            <tbody>
              ${table.columns.map(col => {
                const isPk = col.isPrimaryKey || table.primaryKey.includes(col.name);
                const isFk = col.isForeignKey || table.foreignKeys.some(f => f.columns.includes(col.name));
                const fkDef = table.foreignKeys.find(f => f.columns.includes(col.name));

                return `
                  <tr data-col="${esc(col.name.toLowerCase())}">
                    <td class="col-name">
                      ${esc(col.name)}
                    </td>
                    <td class="col-type">${esc(col.type)}</td>
                    <td>${col.nullable ? '<span style="color: var(--text-muted);">YES</span>' : '<span style="color: var(--rose); font-weight: 700;">NO</span>'}</td>
                    <td class="col-type">${col.default !== null ? esc(col.default) : '<span style="color: var(--text-muted);">&mdash;</span>'}</td>
                    <td class="col-constraint">
                      ${isPk ? '<span class="badge badge-pk">PRIMARY KEY</span> ' : ''}
                      ${isFk && fkDef ? `<span class="badge badge-fk">FK &rarr; ${esc(fkDef.referencedTable)}.${esc(fkDef.referencedColumns.join(','))}</span>` : ''}
                      ${col.autoIncrement ? '<span class="badge badge-engine">AUTO_INC</span>' : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function filterTables() {
      const q = document.getElementById('filterInput').value.toLowerCase().trim();
      const tables = document.querySelectorAll('.table-section');
      tables.forEach(tbl => {
        const tblName = tbl.getAttribute('data-table');
        const rows = tbl.querySelectorAll('tbody tr');
        let matchesCol = false;

        rows.forEach(r => {
          const colName = r.getAttribute('data-col');
          if (colName.includes(q)) {
            r.style.display = '';
            matchesCol = true;
          } else if (q === '') {
            r.style.display = '';
          } else {
            r.style.display = 'none';
          }
        });

        if (q === '' || tblName.includes(q) || matchesCol) {
          tbl.style.display = '';
        } else {
          tbl.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Triggers a formatted print / PDF dialogue with dedicated styling.
 */
export function generatePdfReport(schema: CanonicalSchema): void {
  const html = generateHtmlReport(schema);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  } else {
    // Fallback: trigger download of the standalone HTML report
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadReportBlob(blob, `schemaforge-${schema.database.engine}-report.html`);
  }
}

/**
 * Generates a clean, consolidated SQL DDL script with all tables and foreign keys.
 */
export function generateSqlDump(schema: CanonicalSchema): string {
  const lines: string[] = [
    `-- =====================================================================`,
    `-- SchemaForge Database Definition Script`,
    `-- Target Engine: ${schema.database.engine.toUpperCase()}`,
    `-- Generated At: ${new Date().toUTCString()}`,
    `-- Tables: ${schema.tables.length} | Relationships: ${schema.relationships.length}`,
    `-- =====================================================================\n`
  ];

  for (const table of schema.tables) {
    lines.push(`-- Table: ${table.name}`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);

    const colDefs: string[] = [];
    for (const col of table.columns) {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.autoIncrement) def += ' AUTO_INCREMENT';
      if (col.default !== null) def += ` DEFAULT '${col.default}'`;
      colDefs.push(def);
    }

    if (table.primaryKey.length > 0) {
      colDefs.push(`  PRIMARY KEY (${table.primaryKey.join(', ')})`);
    }

    for (const uq of table.uniqueConstraints) {
      colDefs.push(`  UNIQUE KEY uq_${table.name}_${uq.join('_')} (${uq.join(', ')})`);
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`);\n`);
  }

  // Add Foreign Key Constraints
  if (schema.relationships.length > 0) {
    lines.push(`-- =====================================================================`);
    lines.push(`-- Foreign Key Constraints`);
    lines.push(`-- =====================================================================\n`);

    for (const rel of schema.relationships) {
      lines.push(
        `ALTER TABLE ${rel.sourceTable} ADD CONSTRAINT fk_${rel.sourceTable}_${rel.sourceColumns.join('_')}` +
        ` FOREIGN KEY (${rel.sourceColumns.join(', ')}) REFERENCES ${rel.targetTable} (${rel.targetColumns.join(', ')})` +
        ` ON DELETE CASCADE ON UPDATE CASCADE;`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generates a Markdown documentation file suitable for GitHub wikis and READMEs.
 */
export function generateMarkdownDoc(schema: CanonicalSchema): string {
  const lines: string[] = [
    `# ${schema.database.engine.toUpperCase()} Database Architecture & Data Dictionary`,
    `> Generated by **SchemaForge** on ${new Date().toUTCString()}\n`,
    `## Executive Metrics`,
    `- **Database Engine**: \`${schema.database.engine.toUpperCase()}\``,
    `- **Tables Count**: ${schema.tables.length}`,
    `- **Relationships Count**: ${schema.relationships.length}`,
    `- **Schema Health Score**: **${schema.health.overallScore} / 100**\n`,
    `---`,
    `## Relational Schema Diagram (Mermaid)\n`,
    `\`\`\`mermaid`,
    `erDiagram`
  ];

  // Mermaid relationships
  schema.relationships.forEach(r => {
    const card = r.type === 'many-to-many' ? '}o--o{' : r.type === 'one-to-one' ? '||--||' : '||--o{';
    lines.push(`    ${r.targetTable} ${card} ${r.sourceTable} : references`);
  });

  lines.push(`\`\`\`\n`);

  lines.push(`## Data Dictionary\n`);

  schema.tables.forEach(table => {
    lines.push(`### Table: \`${table.name}\``);
    if (table.comment) lines.push(`_${table.comment}_\n`);

    lines.push(`| Column | Type | Nullable | Default | Constraints |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    table.columns.forEach(col => {
      const isPk = col.isPrimaryKey || table.primaryKey.includes(col.name);
      const isFk = col.isForeignKey || table.foreignKeys.some(f => f.columns.includes(col.name));
      const constraints = [
        isPk ? '**PK**' : '',
        isFk ? 'FK' : '',
        col.autoIncrement ? 'AUTO_INC' : ''
      ].filter(Boolean).join(', ');

      lines.push(
        `| \`${col.name}\` | \`${col.type}\` | ${col.nullable ? 'YES' : 'NO'} | ${col.default !== null ? `\`${col.default}\`` : '-'} | ${constraints || '-'} |`
      );
    });

    lines.push(`\n`);
  });

  return lines.join('\n');
}

/**
 * Generates a CSV data dictionary of all columns for spreadsheets (Excel / Google Sheets).
 */
export function generateCsvDictionary(schema: CanonicalSchema): string {
  const rows: string[][] = [
    ['Table', 'Column', 'Type', 'Nullable', 'Default', 'Is_PrimaryKey', 'Is_ForeignKey', 'References_Table', 'References_Column', 'Comment']
  ];

  schema.tables.forEach(table => {
    table.columns.forEach(col => {
      const isPk = col.isPrimaryKey || table.primaryKey.includes(col.name);
      const fk = table.foreignKeys.find(f => f.columns.includes(col.name));

      rows.push([
        table.name,
        col.name,
        col.type,
        col.nullable ? 'YES' : 'NO',
        col.default !== null ? String(col.default) : '',
        isPk ? 'TRUE' : 'FALSE',
        fk ? 'TRUE' : 'FALSE',
        fk ? fk.referencedTable : '',
        fk ? fk.referencedColumns.join(';') : '',
        col.comment || ''
      ]);
    });
  });

  return rows
    .map(row =>
      row
        .map(cell => {
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\r\n');
}

/**
 * Rasterizes the ERD SVG onto an HTML5 Canvas and exports a high-resolution PNG.
 */
export function exportCanvasAsPng(svgElement: SVGSVGElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // High-res 2x
        const width = 2400;
        const height = 1600;

        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(pngBlob => {
          URL.revokeObjectURL(url);
          if (pngBlob) {
            downloadReportBlob(pngBlob, filename);
            resolve();
          } else {
            reject(new Error('Failed to generate PNG blob'));
          }
        }, 'image/png');
      };

      img.onerror = err => {
        URL.revokeObjectURL(url);
        reject(err);
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Utility helper to trigger browser download of a Blob.
 */
export function downloadReportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

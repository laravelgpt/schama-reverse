import { CanonicalSchema } from '../../types/schema';
import { getAccessToken } from '../firebase/firebase';

export interface WorkspaceDocResult {
  documentId: string;
  title: string;
  url: string;
}

export interface WorkspaceTaskResult {
  taskListId: string;
  taskCount: number;
}

export interface WorkspaceChatResult {
  messageName: string;
  spaceName: string;
}

// 1. Export schema documentation to a Google Doc
export async function exportToGoogleDoc(
  schema: CanonicalSchema,
  docTitle = `SchemaForge - ${schema.database.engine.toUpperCase()} Data Dictionary`
): Promise<WorkspaceDocResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to export to Google Docs.');
  }

  // Create new blank document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: docTitle })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Google Docs API error: ${errorText}`);
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;

  // Build document text
  let bodyText = `SchemaForge Database Documentation\n`;
  bodyText += `Engine: ${schema.database.engine.toUpperCase()} | Health Score: ${schema.health.overallScore}/100\n`;
  bodyText += `Generated: ${new Date().toUTCString()}\n\n`;

  bodyText += `TABLES SUMMARY (${schema.tables.length})\n`;
  for (const table of schema.tables) {
    bodyText += `\nTable: ${table.name} (${table.columns.length} columns)\n`;
    for (const col of table.columns) {
      const flags = [
        col.isPrimaryKey ? 'PK' : '',
        col.isForeignKey ? 'FK' : '',
        col.nullable ? 'NULL' : 'NOT NULL'
      ].filter(Boolean).join(', ');
      bodyText += `  - ${col.name}: ${col.type} (${flags})\n`;
    }
  }

  bodyText += `\nRELATIONSHIPS (${schema.relationships.length})\n`;
  for (const rel of schema.relationships) {
    bodyText += `  - ${rel.sourceTable}.${rel.sourceColumns.join(',')} -> ${rel.targetTable}.${rel.targetColumns.join(',')} [${rel.type.toUpperCase()}] (${rel.confidence})\n`;
  }

  if (schema.warnings.length > 0) {
    bodyText += `\nACTIVE WARNINGS & FINDINGS (${schema.warnings.length})\n`;
    for (const w of schema.warnings) {
      bodyText += `  - [${w.severity.toUpperCase()}] ${w.code}: ${w.message}\n`;
    }
  }

  // Insert text into document
  await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: bodyText
          }
        }
      ]
    })
  });

  return {
    documentId,
    title: docTitle,
    url: `https://docs.google.com/document/d/${documentId}/edit`
  };
}

// 2. Export migration action items to Google Tasks
export async function exportToGoogleTasks(schema: CanonicalSchema): Promise<WorkspaceTaskResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to create Google Tasks.');
  }

  // Create a new task list
  const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `SchemaForge: ${schema.database.engine.toUpperCase()} Migration Tasks`
    })
  });

  if (!listRes.ok) {
    const errorText = await listRes.text();
    throw new Error(`Google Tasks API error: ${errorText}`);
  }

  const listData = await listRes.json();
  const taskListId = listData.id;

  const tasksToCreate: { title: string; notes: string }[] = [
    {
      title: `Review and run Laravel 13 migrations (${schema.tables.length} tables)`,
      notes: `Topological migration order generated with dependency graph. Run php artisan migrate.`
    },
    {
      title: `Verify Foreign Key constraints and indexes`,
      notes: `Check index coverage (${schema.health.indexCoverage}%) and resolve any warnings.`
    },
    {
      title: `Seed test records from parsed fixtures`,
      notes: `Run DatabaseSeeder with bulk insert batches.`
    }
  ];

  // Add tasks for any high-severity warnings
  for (const w of schema.warnings.filter(w => w.severity === 'critical' || w.severity === 'warning')) {
    tasksToCreate.push({
      title: `Address ${w.code} in table '${w.table || 'schema'}'`,
      notes: `${w.message}\nAction: ${w.suggestion || 'Review database definition.'}`
    });
  }

  for (const item of tasksToCreate) {
    await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: item.title,
        notes: item.notes
      })
    });
  }

  return {
    taskListId,
    taskCount: tasksToCreate.length
  };
}

// 3. Send notification to Google Chat space
export async function sendToGoogleChat(
  schema: CanonicalSchema,
  spaceName: string
): Promise<WorkspaceChatResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to send to Google Chat.');
  }

  const messageText = `📊 *SchemaForge Analysis Report*\n` +
    `• Engine: *${schema.database.engine.toUpperCase()}*\n` +
    `• Tables: *${schema.tables.length}* | Relationships: *${schema.relationships.length}*\n` +
    `• Schema Health Score: *${schema.health.overallScore}/100*\n` +
    `• Warnings: *${schema.warnings.length}*\n` +
    `Laravel 13 migrations and models are generated and ready for deployment.`;

  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: messageText })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Chat API error: ${errorText}`);
  }

  const data = await res.json();
  return {
    messageName: data.name,
    spaceName
  };
}

export async function listChatSpaces(): Promise<{ name: string; displayName: string }[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const res = await fetch('https://chat.googleapis.com/v1/spaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.spaces || []).map((s: any) => ({
      name: s.name,
      displayName: s.displayName || s.name
    }));
  } catch {
    return [];
  }
}

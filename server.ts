import express from 'express';
import path from 'path';
import { handleGeminiApi } from './src/server/geminiHandler.ts';

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini API endpoints
app.post('/api/gemini/*', async (req, res) => {
  try {
    const result = await handleGeminiApi(req.url, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gemini API Error' });
  }
});

// Serve production static assets
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SchemaForge server running on port ${port}`);
});

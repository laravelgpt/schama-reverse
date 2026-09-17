import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getGenAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export async function handleGeminiApi(reqUrl: string, body: any): Promise<any> {
  const ai = getGenAi();

  // 1. Analyze Image (model: gemini-3.1-pro-preview)
  if (reqUrl === '/api/gemini/analyze-image') {
    const { imageBase64, mimeType = 'image/png', prompt } = body;
    if (!imageBase64) throw new Error('imageBase64 is required');

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType
              }
            },
            {
              text: prompt ||
                'Analyze this ERD / database diagram image. Identify all tables, columns, primary keys, foreign keys, and relationships. Output valid SQL DDL (CREATE TABLE statements) so that SchemaForge can parse and reverse engineer it.'
            }
          ]
        }
      ]
    });

    return { text: response.text || '' };
  }

  // 2. High Thinking Mode (model: gemini-3.1-pro-preview, thinkingLevel: HIGH, no maxOutputTokens)
  if (reqUrl === '/api/gemini/high-thinking') {
    const { schemaContext, query } = body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are an elite database architect and performance tuning expert.
Here is the canonical schema information in JSON:
${typeof schemaContext === 'string' ? schemaContext : JSON.stringify(schemaContext, null, 2)}

User Complex Query:
${query}

Provide a deep, rigorous analysis. Focus on:
1. Normal form violations (1NF to 3NF/BCNF) and deliberate denormalization trade-offs.
2. Composite index recommendations based on query patterns.
3. Foreign key constraints and circular dependency resolutions.
4. Partitioning, sharding, and high-concurrency storage advice.
5. Specific SQL or Laravel migration optimizations.`
            }
          ]
        }
      ],
      config: {
        thinkingConfig: {
          thinkingLevel: 'HIGH' as any
        }
      }
    });

    return { text: response.text || '' };
  }

  // 3. Analyze Video Content (model: gemini-3.1-pro-preview)
  if (reqUrl === '/api/gemini/analyze-video') {
    const { videoBase64, mimeType = 'video/mp4', prompt } = body;
    if (!videoBase64) throw new Error('videoBase64 is required');

    const cleanBase64 = videoBase64.replace(/^data:video\/[a-z0-9]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType
              }
            },
            {
              text: prompt ||
                'Analyze this database walkthrough video for key schema information, entity relationships, migration steps, and architectural constraints. Summarize findings and extract any database structure mentioned.'
            }
          ]
        }
      ]
    });

    return { text: response.text || '' };
  }

  // 4. Low-Latency Responses (model: gemini-3.1-flash-lite)
  if (reqUrl === '/api/gemini/fast-response') {
    const { prompt, currentTable } = body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Context Table: ${currentTable ? JSON.stringify(currentTable) : 'All tables'}\nPrompt: ${prompt}\nAnswer concisely, accurately, and rapidly.`
            }
          ]
        }
      ]
    });

    return { text: response.text || '' };
  }

  // 5. Search Grounding (model: gemini-3.5-flash with googleSearch tool)
  if (reqUrl === '/api/gemini/search-grounding') {
    const { query } = body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: query }]
        }
      ],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // Extract search grounding metadata if present
    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      text: response.text || '',
      sources: searchChunks.map((chunk: any) => ({
        title: chunk.web?.title || 'Documentation Source',
        uri: chunk.web?.uri || ''
      }))
    };
  }

  throw new Error(`Unknown endpoint: ${reqUrl}`);
}

export interface GeminiResponse {
  text: string;
  sources?: { title: string; uri: string }[];
  error?: string;
}

export async function callGeminiAnalyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt?: string
): Promise<GeminiResponse> {
  const res = await fetch('/api/gemini/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, prompt })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to analyze image with Gemini');
  }
  return data;
}

export async function callGeminiHighThinking(
  schemaContext: any,
  query: string
): Promise<GeminiResponse> {
  const res = await fetch('/api/gemini/high-thinking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schemaContext, query })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed high thinking analysis');
  }
  return data;
}

export async function callGeminiAnalyzeVideo(
  videoBase64: string,
  mimeType: string,
  prompt?: string
): Promise<GeminiResponse> {
  const res = await fetch('/api/gemini/analyze-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoBase64, mimeType, prompt })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed video analysis');
  }
  return data;
}

export async function callGeminiFastResponse(
  prompt: string,
  currentTable?: any
): Promise<GeminiResponse> {
  const res = await fetch('/api/gemini/fast-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, currentTable })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed low-latency response');
  }
  return data;
}

export async function callGeminiSearchGrounding(query: string): Promise<GeminiResponse> {
  const res = await fetch('/api/gemini/search-grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed search grounding');
  }
  return data;
}

// Vercel Node.js Serverless Function — proxies Google Gemini API calls so the key never reaches the browser.
// Node.js runtime (not edge) for full network access.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { system, messages, max_tokens } = req.body ?? {};

    // Convert Anthropic-style { system, messages } to Gemini's { systemInstruction, contents }
    const contents = (messages ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiBody: Record<string, unknown> = { contents };

    if (system) {
      geminiBody.systemInstruction = { parts: [{ text: system }] };
    }

    if (max_tokens) {
      geminiBody.generationConfig = { maxOutputTokens: max_tokens };
    }

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message ?? 'Gemini API error' });
    }

    // Normalize to the same shape the client already expects: { content: [{ text }] }
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ content: [{ text }] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Gemini API call failed' });
  }
}

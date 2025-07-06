import { ModelConfig } from '../types';

// Fetches available Gemini models using the public models.list endpoint.
// Returns a pared down list mapped to our internal ModelConfig.
export async function fetchGoogleModels(apiKey: string): Promise<ModelConfig[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(endpoint, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`models.list request failed with status ${res.status}`);
  }
  const body = (await res.json()) as { models?: any[] };
  if (!body.models || !Array.isArray(body.models)) return [];

  // Filter for text generation capable models
  const generationModels = body.models.filter((m) => {
    const methods: string[] = m.supportedGenerationMethods || [];
    return methods.includes('generateContent') || methods.includes('streamGenerateContent');
  });

  const mapPriority = (name: string): number => {
    if (/flash/i.test(name)) return 1;
    if (/pro/i.test(name)) return 2;
    return 5;
  };

  return generationModels.map<ModelConfig>((m) => ({
    name: m.baseModelId || m.name.replace(/^models\//, ''),
    provider: 'google',
    enabled: true,
    cost_per_token: 0, // TODO map pricing
    max_tokens: m.outputTokenLimit ?? 8192,
    priority: mapPriority(m.name || ''),
    context_window: m.inputTokenLimit ?? 32768,
    use_cases: ['classifier', 'enhancer'],
  }));
} 
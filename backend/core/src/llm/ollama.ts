import type { IntentSpec, GatheredEvidence } from '../schema/intentspec.js';
import type { LLMProvider } from './provider.js';
import { buildDraftPrompt } from './templates.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';

  async draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>> {
    const prompt = buildDraftPrompt(request, context);
    
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'granite3.1-dense:8b',
          prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Ollama API error');
      }

      const data = (await response.json()) as { response: string };
      // Expect LLM to return JSON
      try {
        const parsed = JSON.parse(data.response);
        return parsed as Partial<IntentSpec>;
      } catch {
        return {
          objective: request,
          status: 'draft'
        };
      }
    } catch (error) {
      console.error(error);
      return { objective: request, status: 'draft' };
    }
  }
}

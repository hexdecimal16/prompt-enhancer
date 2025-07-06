import { ProviderInterface, ModelConfig, CategoryConfig, TaskCategory } from '../types';
import { Logger } from '../utils/logger';

export interface TagMap {
  [tag: string]: string[]; // array of category keys
}

export class TagLLMCategorizer {
  private logger: Logger;
  private provider: ProviderInterface;
  private model: ModelConfig;
  private tagMap: TagMap;
  private promptTemplate: string;

  constructor(provider: ProviderInterface, model: ModelConfig, tagMap: TagMap, promptTemplate?: string) {
    this.logger = new Logger('TagLLMCategorizer');
    this.provider = provider;
    this.model = model;
    this.tagMap = tagMap;
    // simple, deterministic template
    this.promptTemplate = promptTemplate || `You are an expert prompt tagger. Given a user prompt, return ALL relevant high-level tags from the following list that apply. Respond with a comma-separated list of tags only, lowercase, no extra words.

Available tags: {{TAGS}}

User prompt: "{{PROMPT}}"

Relevant tags:`;
  }

  /**
   * Classify a prompt and return matching TaskCategories based on the tagMap.
   */
  public async categorize(prompt: string, categoryConfigs: Record<string, CategoryConfig>): Promise<TaskCategory[]> {
    // Prepare tag list and replace template vars.
    const tagList = Object.keys(this.tagMap).join(', ');
    const llmPrompt = this.promptTemplate
      .replace('{{TAGS}}', tagList)
      .replace('{{PROMPT}}', prompt.replace(/\n/g, ' '));

    this.logger.debug('Sending tagging request', { model: this.model.name, prompt_preview: llmPrompt.substring(0, 200) });

    try {
      const response = await this.provider.generate(llmPrompt, {
        model: this.model.name,
        max_tokens: 50,
        temperature: 0
      });

      const rawTags = response.content.trim().toLowerCase();
      
      // Clean up the response to handle various formats
      let cleanedTags = rawTags;
      
      // Remove common prefixes
      cleanedTags = cleanedTags.replace(/^(tags?:\s*|relevant tags?:\s*)/i, '');
      
      // Split on various separators: commas, semicolons, pipes, and whitespace
      const tags = cleanedTags.split(/[,;|\s]+/).map(t => t.trim()).filter(Boolean);

      const catSet = new Set<string>();
      const tagKeywordMap = new Map<string, string[]>(); // Track which tags matched for each category
      
      for (const tag of tags) {
        const mapped = this.tagMap[tag];
        if (mapped) {
          mapped.forEach(catKey => {
            catSet.add(catKey);
            if (!tagKeywordMap.has(catKey)) {
              tagKeywordMap.set(catKey, []);
            }
            tagKeywordMap.get(catKey)!.push(tag);
          });
        }
      }

      const categories: TaskCategory[] = [];
      for (const catKey of catSet) {
        const cfg = categoryConfigs[catKey];
        if (cfg) {
          categories.push({
            name: cfg.name,
            confidence: 0.9, // assume high confidence from LLM tagging
            keywords_matched: tagKeywordMap.get(catKey) || [],
            system_prompt: cfg.system_prompt,
            priority: cfg.priority
          });
        }
      }

      // Sort by priority just like original
      categories.sort((a, b) => a.priority - b.priority);
      return categories;
    } catch (err) {
      this.logger.error('LLM tagging failed', { err });
      return [];
    }
  }
} 
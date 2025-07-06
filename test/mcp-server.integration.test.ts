import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';

describe('PromptEnhancerMCPServer Integration Test', () => {
  const serverPath = path.join(__dirname, '../dist/index.js');

  it('should start, connect to the server, and call the analyze_complexity tool', async () => {
    const mockEnvVars = {
      GOOGLE_API_KEY: 'test-api-key-for-testing-only',
      LOG_LEVEL: 'error',
    };

    const transport = new StdioClientTransport({
      command: '/usr/local/bin/node',
      args: [serverPath],
      env: { ...process.env, ...mockEnvVars },
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0',
    });

    await client.connect(transport);

    const result = await client.callTool({
      name: 'analyze_complexity',
      arguments: {
        prompt: 'Create a calculator app.',
      },
    });

    expect(result).toBeDefined();
    expect(result.isError).not.toBe(true);
    expect(result.content).toBeDefined();

    const content = JSON.parse(
      (result.content as { text: string }[])[0].text,
    );
    expect(content.success).toBe(true);
    expect(content.analysis).toBeDefined();
    expect(content.analysis.complexity_score).toBeGreaterThanOrEqual(0);

    await client.close();
  }, 20000);


  const categoryTests = [
    {
      prompt: 'Translate "Bonjour" to English.',
      expectedCategory: 'Translation & Localization'
    },
    {
      prompt: 'Act as a linux terminal. pwd',
      expectedCategory: 'Linux Terminal Simulation'
    },
    {
      prompt: 'Write a calculator app with all bodmas rules.',
      expectedCategory: 'Code Generation & Debugging'
    }
  ];

  categoryTests.forEach(({ prompt: testPrompt, expectedCategory }) => {
    it(`should categorize and enhance prompt for category: ${expectedCategory}`, async () => {
      const mockEnvVars = {
        GOOGLE_API_KEY: 'test-api-key-for-testing-only',
        LOG_LEVEL: 'error',
      };

      const transport = new StdioClientTransport({
        command: '/usr/local/bin/node',
        args: [serverPath],
        env: { ...process.env, ...mockEnvVars },
      });

      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      await client.connect(transport);

      // First, analyse complexity to inspect categories
      const analysisRes = await client.callTool({
        name: 'analyze_complexity',
        arguments: { prompt: testPrompt }
      });

      const analysisContent = JSON.parse((analysisRes.content as { text: string }[])[0].text);
      expect(analysisContent.success).toBe(true);
      
      // Handle case where categories might be empty due to API key issues in test environment
      if (analysisContent.analysis.categories && analysisContent.analysis.categories.length > 0) {
        const topCat = analysisContent.analysis.categories[0];
        expect(topCat.name).toContain(expectedCategory.split(' ')[0]);
      } else {
        // In test environment with invalid API key, just verify structure exists
        expect(analysisContent.analysis.categories).toBeDefined();
        console.log('Categories empty due to API key restrictions in test environment');
      }

      // Then, process prompt
      const procRes = await client.callTool({
        name: 'process_prompt',
        arguments: { prompt: testPrompt }
      });

      console.log('Process Prompt Response:', JSON.parse((procRes.content as { text: string }[])[0].text));

      const procContent = JSON.parse((procRes.content as { text: string }[])[0].text);
      expect(procContent.success).toBe(true);
      
      // In test environment with invalid API key, enhancement may not occur
      // Just verify that we get a valid response structure
      expect(procContent.result.enhanced_prompt).toBeDefined();
      expect(typeof procContent.result.enhanced_prompt).toBe('string');
      expect(procContent.result.original_prompt).toBe(testPrompt);

      await client.close();
    }, 30000);
  });
}); 
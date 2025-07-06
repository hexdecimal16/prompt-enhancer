import { PromptEnhancerMCPServer } from './mcp-server';

(async () => {
  const server = await PromptEnhancerMCPServer.create();

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})(); 
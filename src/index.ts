#!/usr/bin/env node

import { PromptEnhancerMCPServer } from './mcp-server';

(async () => {
  const server = await PromptEnhancerMCPServer.create();

  // Graceful shutdown handlers
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await server.start();
  } catch (err) {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  }
})(); 
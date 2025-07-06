# Prompt Enhancer MCP Server

This repository contains a Model-Context-Protocol (MCP) compliant server that provides intelligent prompt enhancement, model recommendations, and cost optimization for interacting with Large Language Models (LLMs).

It analyzes user prompts to categorize the underlying task and then enriches the prompt with context, examples, and constraints to elicit higher-quality responses from models. It can also recommend the most suitable model for a task based on complexity, cost, and user preferences.

## ✨ Features

- **Intelligent Prompt Enhancement**: Automatically refines vague prompts into detailed, effective ones.
- **Task Categorization**: Uses an LLM-based tagging system to identify prompt types and contexts.
- **Model Recommendations**: Suggests the best model for each task based on complexity and cost.
- **Cost Optimization**: Tracks and optimizes API usage costs across different providers.
- **Caching**: Intelligent caching to reduce redundant API calls and costs.
- **Multiple Providers**: Support for Google AI, OpenAI, Anthropic, and custom providers.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm 8+
- API keys for at least one LLM provider (Google AI recommended)

### Installation

#### Option 1: Use with Claude Desktop (Recommended)

1. **Clone and build the project:**
   ```bash
   git clone https://github.com/hexdecimal16/prompt-enhancer.git
   cd prompt-enhancer
   npm install
   npm run build
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Add to your Claude Desktop configuration:**

   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "prompt-enhancer": {
         "command": "node",
         "args": [
           "/absolute/path/to/prompt-enhancer/dist/index.js"
         ],
         "env": {
           "GOOGLE_API_KEY": "your_google_api_key_here"
         }
       }
     }
   }
   ```

#### Option 2: Global Installation (Coming Soon)

```bash
npm install -g prompt-enhancer
```

Then configure in Claude Desktop:
```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "command": "npx",
      "args": ["prompt-enhancer"],
      "env": {
        "GOOGLE_API_KEY": "your_google_api_key_here"
      }
    }
  }
}
```

### Environment Configuration

The server requires API keys for LLM providers. Create a `.env` file or set environment variables:

```bash
# Required: At least one provider API key
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Additional providers
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Server configuration
LOG_LEVEL=info
NODE_ENV=production
```

**⚠️ Security Note:** Never commit API keys to version control. Always use environment variables or secure secret management.

## 🛠️ Available Tools

The MCP server provides these tools for Claude Desktop:

### `process_prompt`
Enhances and processes user prompts with intelligent categorization and optimization.

**Parameters:**
- `prompt` (required): The user prompt to enhance
- `options` (optional): Enhancement settings
  - `enhancement_level`: 'basic' | 'detailed' | 'comprehensive'
  - `preferred_provider`: Provider preference
  - `cost_limit`: Maximum cost per request
  - `target_category`: Force specific category

**Example:**
```json
{
  "prompt": "Help me write a function",
  "options": {
    "enhancement_level": "detailed",
    "cost_limit": 0.05
  }
}
```

### `get_recommendations`
Gets model recommendations for a specific prompt.

**Parameters:**
- `prompt` (required): The prompt to analyze
- `options` (optional): Recommendation settings
  - `cost_limit`: Maximum cost constraint
  - `min_quality`: Minimum quality threshold
  - `limit`: Number of recommendations

### `analyze_complexity`
Analyzes prompt complexity and provides detailed metrics.

**Parameters:**
- `prompt` (required): The prompt to analyze

### `get_stats`
Retrieves server statistics and performance metrics.

**Parameters:**
- `detailed` (optional): Include detailed statistics

### `clear_cache`
Clears the server cache to free memory or force fresh responses.

## 🔧 Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/hexdecimal16/prompt-enhancer.git
cd prompt-enhancer

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npm run lint:fix
```

### Project Structure

```
src/
├── config/          # Configuration management
├── providers/       # LLM provider implementations  
├── services/        # Core business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── mcp-server.ts    # Main MCP server implementation
└── index.ts         # Entry point

test/                # Test files
```

### Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

**Note:** Tests use mock API keys for security. Never commit real API keys to test files.

## 📖 Configuration

### Provider Configuration

The server automatically configures providers based on available API keys:

- **Google AI**: Requires `GOOGLE_API_KEY`
- **OpenAI**: Requires `OPENAI_API_KEY`  
- **Anthropic**: Requires `ANTHROPIC_API_KEY`

### Advanced Configuration

You can customize behavior through environment variables:

```bash
# Cost and performance settings
DEFAULT_COST_LIMIT=0.10
DEFAULT_ENHANCEMENT_LEVEL=detailed
MAX_CONCURRENT_REQUESTS=10

# Cache configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Logging
LOG_LEVEL=info
```

## 🔒 Security

- **API Keys**: Always use environment variables, never hardcode keys
- **Transport**: Uses secure stdio transport for Claude Desktop
- **Validation**: All inputs are validated and sanitized
- **Logging**: Sensitive data is never logged

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contributing Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## 📋 Requirements

- **Node.js**: 16.0.0 or higher
- **npm**: 8.0.0 or higher
- **API Keys**: At least one LLM provider API key

## 🐛 Troubleshooting

### Common Issues

**"Provider not found" error:**
- Ensure you have set the required API key environment variable
- Check that the API key is valid and has proper permissions

**"Module not found" error:**
- Run `npm run build` to compile TypeScript
- Ensure all dependencies are installed with `npm install`

**Performance issues:**
- Enable caching with `CACHE_TTL=3600`
- Adjust `MAX_CONCURRENT_REQUESTS` based on your system

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Inspired by the MCP community and best practices
- Thanks to all contributors and the open source community 
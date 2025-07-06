# Prompt Enhancer MCP Server

A sophisticated Model Context Protocol (MCP) server that provides intelligent prompt enhancement with real-time web search and content integration. The server analyzes user prompts, categorizes tasks, searches the web for relevant context, and generates enhanced prompts optimized for better LLM responses.

## ✨ Features

- **🔍 Web-Enhanced Prompts**: Automatically searches the web and integrates relevant, up-to-date content into prompts
- **🧠 Intelligent Task Categorization**: Uses LLM-based analysis to identify prompt types and contexts
- **📊 Model Recommendations**: Suggests the best model for each task based on complexity and requirements
- **⚡ Fast Search Integration**: Powered by Brave Search API with smart fallback mechanisms
- **🎯 Relevance-Based Query Generation**: Creates optimized search queries ordered by relevance to the original prompt
- **📈 Smart Caching**: Intelligent caching to reduce redundant API calls and improve performance
- **🔗 Multiple Provider Support**: Works with Google AI, OpenAI, Anthropic, and other providers

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Brave Search API Key** (required for web search functionality)
- **LLM Provider API Key** (Google AI recommended for categorization)

### Installation

#### Option 1: Use with Claude Desktop (Recommended)

1. **Clone and build the project:**
   ```bash
   git clone https://github.com/your-username/prompt-enhancer.git
   cd prompt-enhancer
   npm install
   npm run build
   ```

2. **Add to your Claude Desktop configuration:**

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
           "GOOGLE_API_KEY": "your_google_api_key_here",
           "BRAVE_API_KEY": "your_brave_search_api_key_here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** to load the MCP server.

#### Option 2: Global Installation (Coming Soon)

```bash
npm install -g prompt-enhancer
```

### API Keys Setup

#### Required: Brave Search API Key
1. Sign up at [Brave Search API](https://api.search.brave.com/)
2. Get your API key from the dashboard
3. Add it to your MCP configuration as `BRAVE_API_KEY`

#### Required: LLM Provider API Key
Choose one of the following providers:

**Google AI (Recommended):**
1. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add as `GOOGLE_API_KEY`

**OpenAI:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add as `OPENAI_API_KEY`

**Anthropic:**
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Add as `ANTHROPIC_API_KEY`

## 🛠️ Available Tools

### `process_prompt`
Enhances prompts with intelligent web search and categorization.

**Parameters:**
- `prompt` (required): The user prompt to enhance
- `options` (optional): Enhancement settings
  - `enhancement_level`: `'basic'` | `'detailed'` | `'comprehensive'` (default: `'detailed'`)
  - `preferred_provider`: Provider preference for LLM calls
  - `cost_limit`: Maximum cost per request (default: `0.01`)
  - `target_category`: Force specific task category
  - `enable_web_search`: Enable/disable web search (default: `true`)

**Example:**
```json
{
  "prompt": "I want to create a FastAPI server with WebSocket support",
  "options": {
    "enhancement_level": "comprehensive",
    "enable_web_search": true,
    "cost_limit": 0.05
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "original_prompt": "I want to create a FastAPI server with WebSocket support",
    "enhanced_prompt": "Create a production-ready FastAPI server with WebSocket support...",
    "categories": [{"name": "Code Generation & Debugging", "confidence": 0.95}],
    "web_context": [...],
    "processing_metadata": {
      "search_time": 4400,
      "scraping_time": 39100,
      "total_time": 47600,
      "urls_processed": 3,
      "success_rate": 0.67
    }
  }
}
```

### `get_recommendations`
Gets model recommendations optimized for the specific prompt type.

**Parameters:**
- `prompt` (required): The prompt to analyze
- `options` (optional): Recommendation settings
  - `cost_limit`: Maximum cost constraint
  - `min_quality`: Minimum quality threshold
  - `limit`: Number of recommendations (default: 3)

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
git clone https://github.com/your-username/prompt-enhancer.git
cd prompt-enhancer

# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint
```

### Project Structure

```
src/
├── config/                 # Configuration management
├── providers/              # LLM provider implementations  
├── services/               # Core business logic
│   ├── web-search/         # Web search engines (Brave API)
│   └── web-scraping/       # Content scraping utilities
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── mcp-server.ts          # Main MCP server implementation
└── index.ts               # Entry point

test/                      # Test files
```

### Environment Variables

For development, create a `.env` file:

```bash
# Required: LLM Provider (choose one)
GOOGLE_API_KEY=your_google_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Required: Web Search
BRAVE_API_KEY=your_brave_search_api_key_here

# Optional: Configuration
LOG_LEVEL=info
NODE_ENV=development
```

## 🌐 Web Search & Content Integration

The server uses **Brave Search API** as the primary source for web search with intelligent content scraping:

### How It Works

1. **Task Analysis**: Analyzes your prompt to understand the task type and generate relevant search queries
2. **Smart Search**: Uses Brave Search API to find the most relevant and recent content
3. **Content Extraction**: Scrapes content from top URLs using stealth techniques to avoid blocking
4. **Relevance Scoring**: Filters and ranks content based on relevance to your original prompt
5. **Context Integration**: Seamlessly integrates web content into an enhanced prompt

### Search Features

- **Rate Limiting**: Automatic rate limit handling with intelligent retry logic
- **Relevance-Based Ranking**: Search queries ordered by relevance to original prompt
- **Content Quality Filtering**: Filters out low-quality or irrelevant content
- **Cross-Platform Compatibility**: Works on all major operating systems

## 📊 Performance & Metrics

Example performance metrics from real usage:

```
Search Phase:    4.4s for 2 queries (10 results)
Content Scraping: 39.1s for 3 URLs (67% success rate)
LLM Enhancement:  2.5s processing time
Total Processing: 47.6s end-to-end
```

## 🔒 Security & Privacy

- **No Data Storage**: No user prompts or responses are stored persistently
- **API Key Security**: All API keys are handled securely through environment variables
- **Rate Limiting**: Built-in rate limiting prevents API abuse
- **Stealth Scraping**: Uses advanced techniques to avoid detection and blocking

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Brave Search API** for providing fast and reliable search results
- **MCP (Model Context Protocol)** for enabling seamless AI integration
- **Claude Desktop** for excellent MCP server support 
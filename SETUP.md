# Prompt Enhancer MCP Server Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Build the Project**
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

4. **Start the Server**
   ```bash
   npm start
   ```

## Architecture Overview

The Prompt Enhancer MCP Server provides intelligent prompt enhancement with cost optimization through:

### Core Components

1. **Task Categorizer** (`src/services/task-categorizer.ts`)
   - Analyzes prompts using lightweight pattern matching
   - Categorizes into 9 predefined categories
   - Calculates complexity scores

2. **Model Decision Engine** (`src/services/model-decision-engine.ts`)
   - Selects optimal models based on task requirements
   - Balances cost, quality, and speed
   - Supports user preferences

3. **Prompt Enhancer** (`src/services/prompt-enhancer.ts`)
   - Improves prompts using cost-effective models
   - Applies multiple enhancement strategies
   - Tracks quality improvements

4. **Cache Service** (`src/services/cache-service.ts`)
   - Intelligent caching for responses and analyses
   - Reduces API costs through cache hits
   - Configurable TTL and size limits

5. **Provider Management** (`src/providers/`)
   - Multi-provider support (OpenAI, Anthropic, Google, Groq)
   - Automatic failover and health checks
   - Cost estimation and tracking

### Task Categories

1. **Code Generation & Debugging** - Programming and debugging tasks
2. **Creative Writing & Content Creation** - Stories, articles, creative content
3. **Data Analysis & Visualization** - Data processing and analysis
4. **Technical Documentation** - API docs and technical writing
5. **Problem Solving & Mathematics** - Logical reasoning and math problems
6. **Research & Information Synthesis** - Research and information gathering
7. **Conversational & General Q&A** - General conversation and questions
8. **Educational & Tutoring** - Teaching and educational content
9. **Business & Professional Writing** - Business communications

## MCP Tools

### 1. process_prompt
Main tool for prompt processing with enhancement and optimal model selection.

**Request:**
```json
{
  "tool": "process_prompt",
  "arguments": {
    "prompt": "Write a Python function to calculate fibonacci numbers",
    "enhance": true,
    "cache": true
  }
}
```

**Response:**
```json
{
  "response": {
    "content": "Enhanced response...",
    "tokens_used": {"input": 50, "output": 200, "total": 250},
    "cost": 0.001,
    "model": "gpt-4o-mini",
    "provider": "openai"
  },
  "model_decision": {
    "selected_model": {...},
    "reasoning": "Selected gpt-4o-mini for cost efficiency...",
    "estimated_cost": 0.001
  },
  "enhancement_result": {
    "original_prompt": "...",
    "enhanced_prompt": "...",
    "enhancement_strategies": ["clarity", "specificity"]
  },
  "categories": [...],
  "complexity_score": 0.3
}
```

### 2. get_recommendations
Get model recommendations for a prompt without processing.

**Request:**
```json
{
  "tool": "get_recommendations",
  "arguments": {
    "prompt": "Explain quantum computing",
    "limit": 3
  }
}
```

### 3. analyze_complexity
Analyze prompt complexity and characteristics.

**Request:**
```json
{
  "tool": "analyze_complexity",
  "arguments": {
    "prompt": "Create a machine learning model for image classification"
  }
}
```

### 4. get_stats
Get server performance statistics.

**Request:**
```json
{
  "tool": "get_stats",
  "arguments": {
    "detailed": true
  }
}
```

### 5. clear_cache
Clear the server cache.

**Request:**
```json
{
  "tool": "clear_cache",
  "arguments": {}
}
```

## Configuration

### Environment Variables

```bash
# Required: At least one API key
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=your-google-key
GROQ_API_KEY=gsk_your-groq-key

# Optional configuration
LOG_LEVEL=info
CACHE_TTL=3600
MAX_COST_PER_REQUEST=0.05
PRIORITIZE_SPEED=false
ENABLE_CACHING=true
QUALITY_OVER_COST=false
```

### Model Configuration

The server automatically configures models based on available API keys:

- **OpenAI**: GPT-4o, GPT-4o-mini
- **Anthropic**: Claude-3.5-Sonnet, Claude-3-Haiku
- **Google**: Gemini-1.5-Pro, Gemini-1.5-Flash
- **Groq**: Llama models (ultra-fast inference)

## Cost Optimization Features

1. **Smart Model Selection**
   - Routes simple tasks to cheaper models
   - Uses expensive models only when necessary

2. **Prompt Enhancement**
   - Improves prompt quality to reduce iterations
   - Uses cheap models for enhancement

3. **Intelligent Caching**
   - Caches responses to avoid redundant API calls
   - Configurable cache settings

4. **Provider Optimization**
   - Selects most cost-effective provider per task
   - Automatic failover between providers

## Usage Examples

### Basic Prompt Processing
```bash
# Start the server
npm start

# In another terminal, use with MCP client
echo '{"tool": "process_prompt", "arguments": {"prompt": "Hello world"}}' | your-mcp-client
```

### Getting Model Recommendations
```bash
echo '{"tool": "get_recommendations", "arguments": {"prompt": "Complex data analysis task", "limit": 3}}' | your-mcp-client
```

### Checking Server Stats
```bash
echo '{"tool": "get_stats", "arguments": {"detailed": true}}' | your-mcp-client
```

## Development

### File Structure
```
src/
├── config/              # Configuration management
├── providers/           # LLM provider implementations
├── services/           # Core business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── mcp-server.ts       # Main MCP server
└── index.ts           # Entry point
```

### Adding New Providers
1. Create provider class in `src/providers/`
2. Implement `ProviderInterface`
3. Register in `src/providers/index.ts`
4. Add environment variable support

### Adding New Categories
1. Add category definition in `src/config/configuration-manager.ts`
2. Update pattern matching in `src/services/task-categorizer.ts`

## Troubleshooting

### Common Issues

1. **No API keys configured**
   - Check .env file exists and has valid API keys
   - Verify at least one provider is available

2. **TypeScript compilation errors**
   - Use `./build.sh` which allows some errors for demo
   - Or fix specific errors in the source files

3. **Cache issues**
   - Clear cache using the `clear_cache` tool
   - Check cache settings in environment variables

4. **Model not available**
   - Verify API key is valid
   - Check provider health in stats

### Logs
The server provides detailed logging at different levels:
- ERROR: Critical errors
- WARN: Warning conditions  
- INFO: General information
- DEBUG: Detailed debugging

Set `LOG_LEVEL=debug` for verbose output.

## Performance Targets

- **98% cost reduction** through smart routing and caching
- **4% performance improvement** through prompt enhancement
- **Sub-second response times** for cached requests
- **90%+ cache hit rate** for repeated patterns

## Support

For issues and questions:
1. Check the logs for error details
2. Verify your configuration
3. Test with simple prompts first
4. Review the MCP tool documentation 
# Prompt Enhancer Setup Guide

This guide will help you set up the Prompt Enhancer MCP server with web search integration and intelligent prompt enhancement.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and npm installed
- **API Keys** for required services:
  - Brave Search API key (required for web search)
  - At least one LLM provider API key (Google AI, OpenAI, or Anthropic)

## 🚀 Installation Methods

### Method 1: Claude Desktop Integration (Recommended)

This is the most common way to use the prompt enhancer with Claude Desktop.

#### Step 1: Download and Build

```bash
# Clone the repository
git clone https://github.com/your-username/prompt-enhancer.git
cd prompt-enhancer

# Install dependencies
npm install

# Build the project
npm run build
```

#### Step 2: Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration file:

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

#### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

### Method 2: Development Mode

For development and testing:

```bash
# Clone and install
git clone https://github.com/your-username/prompt-enhancer.git
cd prompt-enhancer
npm install

# Create environment file
cat > .env << EOF
GOOGLE_API_KEY=your_google_api_key_here
BRAVE_API_KEY=your_brave_search_api_key_here
LOG_LEVEL=debug
NODE_ENV=development
EOF

# Run in development mode
npm run dev
```

## 🔑 API Keys Setup

### Brave Search API (Required)

The Brave Search API provides fast, reliable web search results.

1. **Sign Up**: Visit [Brave Search API](https://api.search.brave.com/)
2. **Get API Key**: Create an account and get your API key
3. **Add to Configuration**: Add as `BRAVE_API_KEY` in your MCP config

**Pricing**: Free tier includes 2,000 queries/month. Paid plans available for higher usage.

### LLM Provider API Keys (Required)

Choose one of the following providers:

#### Google AI (Recommended for most users)

- **Best for**: General use, cost-effective, fast response times
- **Setup**: Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Configuration**: Add as `GOOGLE_API_KEY`

#### OpenAI 

- **Best for**: High-quality outputs, advanced reasoning
- **Setup**: Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Configuration**: Add as `OPENAI_API_KEY`

#### Anthropic

- **Best for**: Safety-focused applications, detailed analysis
- **Setup**: Get your key from [Anthropic Console](https://console.anthropic.com/)
- **Configuration**: Add as `ANTHROPIC_API_KEY`

## 🔧 Configuration Options

### Environment Variables

All configuration is done through environment variables:

```bash
# Required API Keys
GOOGLE_API_KEY=your_google_api_key_here
BRAVE_API_KEY=your_brave_search_api_key_here

# Optional: Additional LLM Providers
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Logging and Performance
LOG_LEVEL=info                    # error, warn, info, debug, verbose
NODE_ENV=production               # production, development
```

### MCP Configuration

When using with Claude Desktop, you can also set these in the MCP server configuration:

```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "command": "node",
      "args": ["/path/to/prompt-enhancer/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_key_here",
        "BRAVE_API_KEY": "your_key_here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🧪 Testing Your Setup

### Basic Functionality Test

Once set up, test the server with Claude Desktop:

```
Use the process_prompt tool to enhance this prompt: "Help me create a web server"
```

Expected behavior:
- Server analyzes the prompt
- Searches the web for relevant tutorials and documentation
- Returns an enhanced prompt with specific requirements and context

### Advanced Test

Try a more complex prompt:

```json
{
  "prompt": "I need to build a real-time chat application",
  "options": {
    "enhancement_level": "comprehensive",
    "enable_web_search": true
  }
}
```

Expected output should include:
- Enhanced prompt with specific technologies and requirements
- Web context from recent tutorials and documentation
- Performance metrics showing search and scraping times

## 🔍 Troubleshooting

### Common Issues

#### 1. "MCP server not found" or connection errors

**Solution:**
- Verify the path to `dist/index.js` is correct and absolute
- Ensure the project was built successfully with `npm run build`
- Check Claude Desktop logs for specific error messages

#### 2. "API key invalid" errors

**Solution:**
- Verify your API keys are correct and active
- Check that keys are properly set in the MCP configuration
- Ensure you have sufficient credits/quota for your chosen providers

#### 3. Web search not working

**Solution:**
- Verify `BRAVE_API_KEY` is set correctly
- Check Brave Search API dashboard for usage limits
- Ensure your API key has the necessary permissions

#### 4. Slow performance

**Common causes and solutions:**
- **Content scraping timeout**: Normal for 30-60 seconds on first run
- **Rate limiting**: Server automatically handles this with retries
- **Large content**: Content is automatically truncated for efficiency

### Debug Mode

Enable detailed logging to diagnose issues:

```json
{
  "env": {
    "LOG_LEVEL": "debug",
    "NODE_ENV": "development"
  }
}
```

## 📊 Performance Optimization

### Expected Performance

Typical performance metrics:
- **Search Phase**: 2-5 seconds for query generation and web search
- **Content Scraping**: 20-60 seconds for 2-3 URLs
- **Enhancement**: 1-3 seconds for prompt enhancement
- **Total**: 30-70 seconds end-to-end

### Optimization Tips

1. **Use caching**: The server automatically caches results for identical prompts
2. **Limit search scope**: Use specific enhancement levels to control processing time
3. **Monitor usage**: Check API usage to avoid rate limits

## 🔒 Security Best Practices

### API Key Security

- **Never commit API keys** to version control
- **Use environment variables** for all sensitive configuration
- **Rotate keys regularly** according to provider recommendations
- **Monitor usage** for unexpected spikes that might indicate compromise

### Network Security

- All API communications use HTTPS
- No user data is stored persistently
- All web scraping respects robots.txt and rate limits

## 🔄 Updates and Maintenance

### Keeping Updated

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Rebuild
npm run build

# Restart Claude Desktop to reload
```

### Monitoring

The server provides built-in monitoring through the `get_stats` tool:

```json
{
  "tool": "get_stats",
  "options": { "detailed": true }
}
```

This returns:
- API usage statistics
- Performance metrics
- Cache hit rates
- Error rates

## 🆘 Getting Help

### Support Channels

1. **GitHub Issues**: Report bugs and request features
2. **Discussions**: Community support and questions
3. **Documentation**: Check README.md for detailed API documentation

### Providing Feedback

When reporting issues, please include:
- Your operating system and Node.js version
- Complete error messages and logs
- Steps to reproduce the issue
- Your configuration (without API keys)

## 📈 Advanced Configuration

### Custom Provider Settings

You can add multiple providers and let the system choose the best one:

```json
{
  "env": {
    "GOOGLE_API_KEY": "key1",
    "OPENAI_API_KEY": "key2",
    "ANTHROPIC_API_KEY": "key3"
  }
}
```

The system will automatically:
- Select the best model for each task
- Handle rate limits and fallbacks
- Optimize for cost and performance

### Performance Tuning

For high-volume usage:

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable production optimizations
NODE_ENV=production
```

This setup guide should get you up and running with the Prompt Enhancer MCP server. The system is designed to work out of the box with minimal configuration while providing advanced options for power users. 
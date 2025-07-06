# Contributing to Prompt Enhancer MCP Server

Thank you for your interest in contributing to the Prompt Enhancer MCP Server! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Environment details** (Node.js version, OS, etc.)
- **Log output** if relevant
- **Configuration** (anonymized, no API keys)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

- **Clear description** of the enhancement
- **Use case** and motivation
- **Detailed proposal** for implementation
- **Alternatives considered**

### Development Setup

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/prompt-enhancer.git
   cd prompt-enhancer
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. **Build the project**:
   ```bash
   npm run build
   ```

6. **Run tests**:
   ```bash
   npm test
   ```

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

4. **Commit your changes**:
   ```bash
   git commit -m "feat: add new feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

### Coding Standards

#### TypeScript Guidelines

- Use **strict TypeScript** configuration
- Define **interfaces** for all data structures
- Use **type guards** for runtime type checking
- Prefer **explicit types** over `any`
- Document **complex types** with JSDoc comments

#### Code Style

- Use **Prettier** for formatting (run `npm run lint:fix`)
- Follow **ESLint** rules (run `npm run lint`)
- Use **meaningful variable names**
- Keep **functions small** and focused
- Add **JSDoc comments** for public APIs

#### Testing

- Write **unit tests** for new functionality
- Maintain **test coverage** above 80%
- Use **descriptive test names**
- Mock **external dependencies**
- Test **error conditions**

#### MCP Protocol Compliance

- Follow **JSON-RPC 2.0** specification
- Implement **proper error handling** with MCP error codes
- Use **schema validation** for tool inputs
- Support **batch requests** where applicable
- Document **tool schemas** thoroughly

### Pull Request Guidelines

#### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-review of the code has been performed
- [ ] Tests have been added/updated
- [ ] Documentation has been updated
- [ ] No breaking changes without discussion

#### PR Description

Include in your PR description:

- **Summary** of changes
- **Motivation** and context
- **Testing** performed
- **Breaking changes** (if any)
- **Screenshots** (if applicable)

#### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainers
3. **Testing** in development environment
4. **Approval** and merge

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
docs/                # Documentation
```

### Adding New Features

#### New Providers

1. Implement the `ProviderInterface`
2. Add configuration schema
3. Include in provider factory
4. Add comprehensive tests
5. Update documentation

#### New Tools

1. Define tool schema with Zod
2. Implement request handler
3. Add input validation
4. Include error handling
5. Write unit tests
6. Update tool documentation

#### New Services

1. Follow dependency injection patterns
2. Implement proper error handling
3. Add logging where appropriate
4. Include comprehensive testing
5. Document public APIs

### Documentation

- Update **README.md** for user-facing changes
- Add **JSDoc comments** for new APIs
- Update **configuration examples**
- Include **troubleshooting** for new features

### Release Process

1. **Version bump** following semantic versioning
2. **Changelog** update with all changes
3. **Testing** in staging environment
4. **Tag** and create GitHub release
5. **NPM publish** (maintainers only)

### Community

- **Be respectful** and inclusive
- **Help others** in discussions
- **Share knowledge** and best practices
- **Follow up** on your contributions

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community discussion
- **Documentation**: Check README and code comments

### Recognition

Contributors will be recognized in:

- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub contributors** page

Thank you for contributing to make the Prompt Enhancer MCP Server better! 🚀 
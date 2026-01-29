# Contributing to treeli

Thank you for your interest in contributing to treeli!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/germtb/treeli.git
   cd treeli
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run tests to verify setup:
   ```bash
   bun test
   ```

## Development Workflow

### Running Tests

```bash
bun test
```

### Type Checking

```bash
bun run typecheck
```

### Building

```bash
bun run build
```

### Running Examples

```bash
bun examples/demo.ts
bun examples/jsx-demo.tsx
```

## Code Style

- Use TypeScript for all source files
- Follow existing code patterns in the codebase
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests and type checking:
   ```bash
   bun test
   bun run typecheck
   ```
5. Commit your changes with a clear message
6. Push to your fork
7. Open a Pull Request

### PR Guidelines

- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Ensure all tests pass before requesting review

## Reporting Issues

When reporting bugs, please include:

- Your environment (OS, Bun version, Node version)
- Steps to reproduce
- Expected vs actual behavior
- Any relevant error messages

## Questions?

Feel free to open an issue for questions or discussion.

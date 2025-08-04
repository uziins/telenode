# Contributing to TeleNode

Thank you for your interest in contributing to TeleNode! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/telenode.git
   cd telenode
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Development Environment**
   ```bash
   cp .env.example .env
   npm run setup env
   npm run setup db
   ```

4. **Run in Development Mode**
   ```bash
   npm run dev
   ```

## 📋 Code Guidelines

### Code Style

- Use ES6+ features and modern JavaScript syntax
- Follow existing code patterns and naming conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs and complex functions
- Keep functions small and focused on single responsibilities

### File Structure

```
src/
├── app.js              # Main application entry point
├── config.js           # Configuration management
├── plugin.js           # Base plugin class
├── pluginManager.js    # Plugin management system
├── masterPlugin.js     # System management plugin
├── helpers/            # Utility modules
│   ├── auth.js         # Authentication & authorization
│   ├── cache.js        # Caching system
│   ├── performance.js  # Performance monitoring
│   └── ...
├── models/             # Database models
│   ├── plugins.js
│   ├── users.js
│   └── ...
└── ...

plugins/
├── plugin-name/
│   ├── index.js        # Main plugin file
│   ├── package.json    # Plugin metadata
│   └── README.md       # Plugin documentation
└── ...
```

### Plugin Development Standards

1. **Plugin Class Structure**
   ```javascript
   import Plugin from "../../src/plugin.js";

   class YourPlugin extends Plugin {
       get commands() {
           return {
               commandname: this.handleCommand.bind(this)
           };
       }

       async handleCommand({message, args}) {
           // Implementation
       }
   }

   export default YourPlugin;
   ```

2. **Error Handling**
   - Always handle errors gracefully
   - Use try-catch blocks for async operations
   - Log errors appropriately
   - Provide meaningful error messages to users

3. **Performance Considerations**
   - Use caching for expensive operations
   - Implement rate limiting for resource-intensive commands
   - Clean up resources properly
   - Avoid blocking operations

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write unit tests for new features
- Test error conditions and edge cases
- Use descriptive test names
- Follow the existing test patterns

### Plugin Testing

Test your plugins thoroughly:
- Test all commands with various inputs
- Test permission levels
- Test error handling
- Test with different chat types (private, group, supergroup)

## 📝 Documentation

### Code Documentation

- Add JSDoc comments to public methods and classes
- Document complex algorithms or business logic
- Keep comments up-to-date with code changes

### Plugin Documentation

Each plugin should include:
- Clear description of functionality
- Usage examples
- Configuration options
- Dependencies (if any)

## 🔄 Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the code guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run plugin:check
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   Use conventional commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Guidelines

- Provide a clear description of changes
- Reference related issues (if any)
- Include screenshots for UI changes
- Ensure all checks pass
- Request review from maintainers

## 🐛 Bug Reports

When reporting bugs, please include:

- **Environment Information**
  - Node.js version
  - Operating system
  - TeleNode version

- **Steps to Reproduce**
  - Clear, numbered steps
  - Expected vs actual behavior
  - Error messages or logs

- **Additional Context**
  - Screenshots (if applicable)
  - Related configuration
  - Plugin versions

## 💡 Feature Requests

For feature requests:

- Check existing issues first
- Provide clear use case
- Explain the problem it solves
- Consider implementation complexity
- Be open to discussion and alternatives

## 🏷️ Plugin Marketplace

### Submitting Plugins

To submit a plugin to the marketplace:

1. Ensure plugin follows all guidelines
2. Include comprehensive documentation
3. Test thoroughly across different scenarios
4. Follow semantic versioning
5. Submit through the marketplace API

### Plugin Quality Standards

- Well-documented functionality
- Proper error handling
- Security considerations
- Performance optimization
- User-friendly interface

## 📊 Performance Guidelines

- Use caching for frequently accessed data
- Implement proper rate limiting
- Monitor memory usage
- Optimize database queries
- Use async/await properly

## 🔒 Security Guidelines

- Validate all user inputs
- Use parameterized queries
- Implement proper authentication
- Follow principle of least privilege
- Keep dependencies updated

## 📞 Getting Help

- Check the documentation first
- Search existing issues
- Join our community discussions
- Ask questions in issues (use appropriate labels)

## 🎯 Development Roadmap

Check our [project board](https://github.com/uziins/telenode/projects) for:
- Planned features
- Current priorities
- Development status
- How to contribute to specific areas

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Community showcases

Thank you for contributing to TeleNode! 🚀

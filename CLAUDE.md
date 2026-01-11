# Claude Development Environment Guide

## Overview
This project uses Claude Code with a standardized toolchain for AI-assisted development, project management, deployment, and monitoring.

## Available Tools & Integrations

### 📋 Project Management
**Linear MCP** - Issue tracking and project management
- Create, update, and track issues
- Link commits to Linear issues (use issue identifiers like `LIN-123` in commit messages)
- Manage project milestones and sprints
- View team progress and backlogs

**Usage patterns:**
```bash
# List current issues
claude code "show my open issues"

# Create a new issue
claude code "create a Linear issue for implementing user authentication"

# Update issue status
claude code "move LIN-123 to In Progress"
```

### 🚀 Code Review & Quality
**PR Agent (Qodo)** - Automated code review and PR enhancement
- Automatic PR descriptions based on code changes
- Code quality suggestions and best practices
- Security vulnerability detection
- Test coverage analysis

**GitHub Integration:**
- PR Agent runs automatically on pull requests
- Use `/describe` to generate PR descriptions
- Use `/review` for detailed code review
- Use `/improve` for code enhancement suggestions

### 🔍 Code Intelligence
**Context7 MCP** - Codebase analysis and semantic search
- Semantic search across the entire codebase
- Understand code relationships and dependencies
- Find usage patterns and examples
- Navigate large codebases efficiently

**Serena MCP** - Advanced code understanding
- Deep code analysis and refactoring suggestions
- Architecture pattern recognition
- Code smell detection
- Dependency analysis

### 📦 Deployment & Infrastructure
**Cloudflare** - Edge deployment and services
- Pages for frontend deployment
- Workers for serverless functions
- R2 for object storage
- D1 for edge databases

**Deployment workflow:**
1. Push to `main` branch triggers automatic deployment
2. Preview deployments for PRs
3. Review deployment logs in Cloudflare dashboard

### 🐛 Error Tracking & Monitoring
**Sentry** - Real-time error tracking and performance monitoring
- Automatic error capture and reporting
- Performance monitoring and profiling
- Release tracking
- Source map support for debugging

**Setup requirements:**
- Set `SENTRY_DSN` in environment variables
- Include release version in deployments
- Enable source maps for production builds

### ⚡ Claude Superpowers
**Superpowers Plugin** - Enhanced Claude Code capabilities and workflow skills
- Extended context awareness and multi-file refactoring
- Advanced workflow skills for development processes
- Test-driven development (TDD) workflows
- Systematic debugging and code review processes
- Brainstorming and planning skills
- Git worktree management
- Parallel agent dispatching for complex tasks

**Installation:**
```bash
# Add the superpowers marketplace
/plugin marketplace add obra/superpowers-marketplace

# Install the superpowers plugin
/plugin install superpowers@superpowers-marketplace
```

**Available Skills:**
- `/brainstorming` - Explore requirements before implementation
- `/tdd` - Test-driven development workflow
- `/debugging` - Systematic debugging approach
- `/code-review` - Request code review before merging
- `/git-worktrees` - Manage isolated git worktrees
- `/writing-plans` - Create detailed implementation plans
- `/executing-plans` - Execute multi-step plans with checkpoints

**Usage:**
```bash
# Use skills directly in conversation
claude code "/brainstorming implement user authentication"
claude code "/tdd create user service"
claude code "/code-review before merging feature branch"
```

## Development Workflow

### 1. Starting New Work
```bash
# Check current state
claude code "what issues are assigned to me in Linear?"

# Create a branch for your work
git checkout -b feature/LIN-XXX-description

# Begin development with Claude
claude code "implement [feature] for LIN-XXX"
```

### 2. Development Process
- **Use Linear issue identifiers** in branch names and commits
- **Let Claude access Context7/Serena** for codebase understanding
- **Leverage Superpowers** for complex refactoring
- **Write tests** alongside implementation

### 3. Creating Pull Requests
```bash
# Commit with Linear reference
git commit -m "feat(LIN-XXX): implement user authentication"

# Push and create PR
git push origin feature/LIN-XXX-description
gh pr create --fill
```

- PR Agent will automatically analyze the PR
- Review PR Agent suggestions before requesting human review
- Update Linear issue status to "In Review"

### 4. Post-Deployment
- Monitor Sentry for errors
- Check Cloudflare analytics for performance
- Update Linear issue to "Done"
- Document any lessons learned

## Best Practices

### Commit Messages
Follow Conventional Commits with Linear references:
```
feat(LIN-123): add user authentication endpoint
fix(LIN-456): resolve memory leak in data processor
docs(LIN-789): update API documentation
```

### Error Handling
- Use structured error messages for Sentry context
- Include relevant metadata (user ID, request ID, etc.)
- Set appropriate error severity levels
- Add breadcrumbs for debugging context

### Code Quality
- Run PR Agent locally before pushing: `pr-agent --review`
- Address PR Agent suggestions proactively
- Maintain test coverage above 80%
- Use Context7 to find similar patterns in the codebase

### Linear Integration
- Create issues before starting work
- Update issue status as work progresses
- Link related issues and PRs
- Add time estimates for planning

## Environment Variables

Required for full functionality:
```bash
# Sentry
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=development|production

# Cloudflare
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Linear (configured via MCP)
LINEAR_API_KEY=your_linear_key

# PR Agent
QODO_API_KEY=your_qodo_key
```

## Common Commands

### Claude Code Commands
```bash
# Code analysis
claude code "analyze the performance of the data pipeline"
claude code "find all places where we use deprecated APIs"

# Refactoring
claude code "refactor the authentication module to use dependency injection"
claude code "optimize the database queries in UserService"

# Documentation
claude code "document the API endpoints in OpenAPI format"
claude code "create a README for the database migration scripts"

# Debugging
claude code "why is the user login failing in production?"
claude code "analyze the Sentry error for request ID abc-123"
```

### Project Management
```bash
# Linear workflow
claude code "create a spike issue for evaluating Redis alternatives"
claude code "show issues in the current sprint"
claude code "update LIN-XXX with progress notes"

# Release planning
claude code "list all completed issues for the v2.0 release"
claude code "create a release checklist based on recent changes"
```

## Troubleshooting

### MCP Connections
If MCP tools aren't responding:
1. Check MCP server status: `claude code mcp status`
2. Restart MCP servers: `claude code mcp restart`
3. Verify API keys in environment variables

### PR Agent Not Running
1. Check GitHub Actions workflow status
2. Verify PR Agent app is installed on repository
3. Check API key is valid in repository secrets

### Sentry Issues
1. Verify DSN is correct in environment
2. Check source maps are uploaded for production
3. Review rate limits in Sentry dashboard

### Cloudflare Deployment Failures
1. Check build logs in Cloudflare Pages
2. Verify environment variables are set
3. Review deployment settings for branch patterns

## Additional Resources

- **Linear**: Track issues and project progress at [linear.app](https://linear.app)
- **Sentry**: Monitor errors at [sentry.io](https://sentry.io)
- **Cloudflare**: Manage deployments at [dash.cloudflare.com](https://dash.cloudflare.com)
- **PR Agent**: Configure at [qodo.ai](https://qodo.ai)

## Getting Help

When working with Claude:
- Reference this document: "Check CLAUDE.md for workflow details"
- Be specific about Linear issues: "Review LIN-123"
- Provide context: "Using the Cloudflare Workers approach..."
- Ask for explanations: "Why did you choose this pattern?"

---

**Note:** This document should be updated as tools and workflows evolve. Keep it current to maintain development efficiency.

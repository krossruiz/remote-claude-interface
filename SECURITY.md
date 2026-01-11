# Security Guidelines

## Overview

This document outlines security considerations when deploying and using the Remote Claude Interface API.

## Authentication

### API Key Management

- **Never commit API keys to version control**
- Store API keys in environment variables or secure vaults
- Rotate API keys regularly
- Use strong, randomly generated API keys (minimum 32 characters)
- Consider different API keys for different environments (dev, staging, prod)

### Recommendations

```bash
# Generate a strong API key
openssl rand -hex 32
```

## Network Security

### HTTPS/TLS

Always use HTTPS in production:

- Use a reverse proxy (nginx, Caddy, Traefik) with TLS certificates
- Use Let's Encrypt for free SSL certificates
- Enforce HTTPS-only connections
- Use HSTS headers

### Firewall Rules

Restrict network access:

```bash
# Example: Allow only specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

### VPN/SSH Tunneling

For remote access, consider:

- VPN (WireGuard, OpenVPN)
- SSH tunneling
- Cloudflare Tunnel
- Tailscale

## CORS Configuration

Configure `ALLOWED_ORIGINS` appropriately:

```env
# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Production - be specific!
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Workspace Security

### Path Traversal Protection

The API enforces path traversal protection, but:

- Set `WORKSPACE_ROOT` to a dedicated, isolated directory
- Don't use your home directory or system root
- Use a dedicated user account with limited permissions

Example:

```bash
# Create dedicated workspace
mkdir -p ~/claude-workspace
chmod 700 ~/claude-workspace

# Set in .env
WORKSPACE_ROOT=/home/user/claude-workspace
```

### File Permissions

```bash
# Run server as non-root user
useradd -m -s /bin/bash claude-user

# Set workspace ownership
chown -R claude-user:claude-user ~/claude-workspace
```

## Command Execution Security

### Command Validation

The API blocks obviously dangerous commands, but additional validation is recommended:

- Whitelist allowed commands for production use
- Use AppArmor or SELinux to restrict process capabilities
- Run in a containerized environment (Docker)

### Dangerous Patterns Blocked

- `rm -rf /` (without specific path)
- Fork bombs
- Filesystem formatting (`mkfs.*`)
- Direct device writes

### Recommendations

Consider implementing command whitelisting:

```typescript
const ALLOWED_COMMANDS = ['npm', 'git', 'node', 'python3'];

function validateCommand(command: string): boolean {
  const baseCommand = command.split(' ')[0];
  return ALLOWED_COMMANDS.includes(baseCommand);
}
```

## Rate Limiting

Configure appropriate rate limits:

```env
# Adjust based on your needs
MAX_REQUESTS_PER_MINUTE=60
```

For production, consider:

- Using Redis for distributed rate limiting
- Implementing per-user rate limits
- Monitoring for abuse patterns

## Session Management

### Session Timeouts

```env
# Sessions expire after 1 hour of inactivity
SESSION_TIMEOUT_MS=3600000
```

### Session Storage

Current implementation uses in-memory storage. For production:

- Use Redis for distributed session storage
- Implement session persistence
- Monitor active sessions

## Container Security (Docker)

If running in Docker:

```dockerfile
FROM node:20-slim

# Run as non-root user
RUN useradd -m -s /bin/bash claude-user

USER claude-user
WORKDIR /app

# ... rest of Dockerfile

# Don't expose unnecessary ports
EXPOSE 3000

# Use read-only root filesystem
# docker run --read-only --tmpfs /tmp ...
```

## Monitoring and Logging

### Audit Logging

Implement audit logs for:

- Authentication attempts
- File operations
- Command executions
- Session creation/deletion

### Alerting

Set up alerts for:

- Multiple failed authentication attempts
- Unusual command patterns
- High request rates
- Error spikes

## Production Checklist

- [ ] HTTPS enabled with valid certificates
- [ ] Strong API keys in use
- [ ] CORS properly configured
- [ ] Firewall rules in place
- [ ] Workspace isolated with proper permissions
- [ ] Rate limiting configured
- [ ] Running as non-root user
- [ ] Audit logging enabled
- [ ] Monitoring and alerting set up
- [ ] Regular security updates
- [ ] Backup strategy in place

## Incident Response

If you suspect a security breach:

1. Immediately rotate all API keys
2. Review audit logs
3. Check for unauthorized file modifications
4. Review command execution history
5. Update firewall rules if needed
6. Consider shutting down the service temporarily

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

- Do not open a public GitHub issue
- Email security concerns to: [your-email]
- Provide detailed information about the vulnerability
- Allow reasonable time for a fix before public disclosure

## Additional Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

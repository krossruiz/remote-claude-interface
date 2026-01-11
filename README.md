# Remote Claude Interface

A powerful API server that enables remote access to Claude Code running on your desktop. Control Claude Code from web applications, mobile apps, VR headsets, or any HTTP/WebSocket-capable client.

## Features

- 🌐 **RESTful API** - Standard HTTP endpoints for all operations
- ⚡ **WebSocket Support** - Real-time bidirectional communication
- 📁 **File Operations** - Read, write, edit, and delete files remotely
- 💻 **Terminal Commands** - Execute shell commands on your desktop
- 🤖 **Claude Integration** - Full access to Claude's AI capabilities
- 🔒 **Secure** - API key authentication, rate limiting, and path traversal protection
- 📦 **Client SDK** - Easy-to-use TypeScript/JavaScript client library
- 🎯 **Session Management** - Multiple concurrent sessions with automatic cleanup
- 📡 **Streaming** - Real-time streaming for chat and terminal output

## Use Cases

- Control your desktop development environment from a web browser
- Build mobile apps that leverage your desktop's Claude Code
- Create VR interfaces for coding with AI assistance
- Remote pair programming with AI
- Automate desktop tasks from web dashboards

## Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd remote-claude-interface
npm install
```

### 2. Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Server Configuration
PORT=3000
HOST=localhost

# Security
API_KEY=your-secure-api-key-here

# Claude Configuration
WORKSPACE_ROOT=/path/to/your/workspace
ANTHROPIC_API_KEY=your-anthropic-api-key

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### 3. Build and Start

```bash
npm run build
npm start
```

The server will start at `http://localhost:3000` (or your configured port).

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

All API requests require authentication via API key:

**Header:**
```
X-API-Key: your-api-key
```

**Query Parameter:**
```
?apiKey=your-api-key
```

### Endpoints

#### Health Check

```http
GET /health
```

No authentication required. Returns server status.

#### Sessions

```http
POST /api/sessions
GET /api/sessions
GET /api/sessions/:sessionId
DELETE /api/sessions/:sessionId
```

#### Chat

```http
POST /api/chat
GET /api/chat/history/:sessionId
DELETE /api/chat/history/:sessionId
```

**Chat Request Body:**
```json
{
  "sessionId": "optional-session-id",
  "message": "Your message to Claude",
  "stream": false
}
```

**Streaming Response:**
Set `stream: true` to receive Server-Sent Events (SSE) with real-time tokens.

#### File Operations

```http
POST /api/files/read
POST /api/files/write
POST /api/files/edit
POST /api/files/delete
GET /api/files/list?path=/some/directory
GET /api/files/exists?path=/some/file
GET /api/files/info?path=/some/file
```

**Examples:**

```json
// Read file
POST /api/files/read
{
  "path": "src/index.ts",
  "encoding": "utf8"
}

// Write file
POST /api/files/write
{
  "path": "src/newfile.ts",
  "content": "console.log('Hello, World!');",
  "encoding": "utf8"
}

// Edit file
POST /api/files/edit
{
  "path": "src/index.ts",
  "oldString": "old code",
  "newString": "new code",
  "replaceAll": false
}
```

#### Terminal

```http
POST /api/terminal/execute
POST /api/terminal/execute/stream
```

**Execute Command:**
```json
{
  "command": "npm test",
  "cwd": "./",
  "timeout": 120000,
  "env": {
    "NODE_ENV": "test"
  }
}
```

**Response:**
```json
{
  "stdout": "command output",
  "stderr": "error output",
  "exitCode": 0,
  "duration": 1234
}
```

### WebSocket API

Connect to WebSocket at:
```
ws://localhost:3000/ws?apiKey=your-api-key
```

**Message Format:**
```json
{
  "type": "chat|file|terminal|control",
  "payload": { ... },
  "requestId": "optional-unique-id"
}
```

**Response Format:**
```json
{
  "type": "data|complete|error",
  "requestId": "matches-request",
  "payload": { ... }
}
```

## Client SDK Usage

### Installation

The client SDK is located in the `client/` directory. You can copy it to your project or import it directly.

### Basic Usage

```typescript
import { RemoteClaudeClient } from './client/client';

const client = new RemoteClaudeClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
});

// Create a session
const session = await client.createSession();

// Chat with Claude
const response = await client.chat('Hello, Claude!', {
  sessionId: session.sessionId,
});

console.log(response);
```

### Streaming Chat

```typescript
await client.chat('Explain TypeScript generics', {
  sessionId: session.sessionId,
  stream: true,
  onToken: (token) => {
    process.stdout.write(token);
  },
  onComplete: (fullResponse) => {
    console.log('\n\nComplete!');
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});
```

### File Operations

```typescript
// Read a file
const content = await client.readFile({
  path: 'src/index.ts',
  encoding: 'utf8',
});

// Write a file
await client.writeFile({
  path: 'src/newfile.ts',
  content: 'console.log("Hello");',
});

// Edit a file
await client.editFile({
  path: 'src/index.ts',
  oldString: 'const x = 1;',
  newString: 'const x = 2;',
});

// Delete a file
await client.deleteFile('src/oldfile.ts');

// List files
const files = await client.listFiles('src/');
```

### Terminal Commands

```typescript
// Execute command
const result = await client.executeCommand({
  command: 'npm test',
  cwd: './',
});

console.log(result.stdout);
console.log('Exit code:', result.exitCode);

// Execute with streaming
await client.executeCommand({
  command: 'npm install',
  stream: true,
  onStdout: (data) => process.stdout.write(data),
  onStderr: (data) => process.stderr.write(data),
});
```

### WebSocket Usage

```typescript
// Connect to WebSocket
await client.connectWebSocket((message) => {
  console.log('Received:', message);
});

// Chat via WebSocket with streaming
const response = await client.chatViaWebSocket(
  'Hello via WebSocket!',
  session.sessionId,
  (token) => process.stdout.write(token),
);

// Disconnect
client.disconnectWebSocket();
```

## Example Applications

### Web App Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Remote Claude Chat</title>
</head>
<body>
  <div id="chat"></div>
  <input id="input" type="text" placeholder="Type a message..." />
  <button onclick="sendMessage()">Send</button>

  <script type="module">
    import { RemoteClaudeClient } from './client.js';

    const client = new RemoteClaudeClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'your-api-key',
    });

    let sessionId = null;

    async function init() {
      const session = await client.createSession();
      sessionId = session.sessionId;
    }

    window.sendMessage = async function() {
      const input = document.getElementById('input');
      const message = input.value;
      input.value = '';

      const chatDiv = document.getElementById('chat');
      chatDiv.innerHTML += `<p><strong>You:</strong> ${message}</p>`;

      const responseP = document.createElement('p');
      responseP.innerHTML = '<strong>Claude:</strong> ';
      chatDiv.appendChild(responseP);

      await client.chat(message, {
        sessionId,
        stream: true,
        onToken: (token) => {
          responseP.innerHTML += token;
        },
      });
    };

    init();
  </script>
</body>
</html>
```

### Node.js CLI Example

See `examples/cli-client.ts` for a complete command-line interface example.

### React Example

See `examples/react-app/` for a complete React application example.

## Security Considerations

1. **API Key Security**: Keep your API key secret. Use environment variables.
2. **CORS Configuration**: Configure `ALLOWED_ORIGINS` to restrict access.
3. **Workspace Restrictions**: The API enforces path traversal protection within `WORKSPACE_ROOT`.
4. **Command Validation**: Dangerous commands are blocked, but additional validation may be needed.
5. **Rate Limiting**: Configure `MAX_REQUESTS_PER_MINUTE` to prevent abuse.
6. **HTTPS**: Use HTTPS in production with a reverse proxy (nginx, Caddy).
7. **Network Access**: Consider firewall rules to restrict network access.

## Production Deployment

### Using a Reverse Proxy (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
  }
}
```

### Using PM2 for Process Management

```bash
npm install -g pm2
pm2 start dist/server.js --name remote-claude
pm2 save
pm2 startup
```

## Development

### Running in Development Mode

```bash
npm run dev
```

### Watching for Changes

```bash
npm run watch
```

## Troubleshooting

### WebSocket Connection Issues

- Ensure your firewall allows WebSocket connections
- Check that the WebSocket path is `/ws`
- Verify the API key is correct

### File Permission Errors

- Ensure the server process has read/write permissions to `WORKSPACE_ROOT`
- Check file paths are relative to `WORKSPACE_ROOT`

### CORS Errors

- Add your client origin to `ALLOWED_ORIGINS` in `.env`
- Ensure the origin includes the protocol (http/https)

## Architecture

```
┌─────────────────┐
│   Web Client    │
│  Mobile Client  │
│   VR Client     │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  API Server     │
│  (Express +     │
│   WebSocket)    │
├─────────────────┤
│ • Auth          │
│ • Rate Limit    │
│ • Sessions      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│Claude│  │Files │
│Handler│  │+Term│
└──────┘  └──────┘
    │         │
    │    ┌────▼────┐
    │    │Desktop  │
    │    │Filesystem│
    │    └─────────┘
    │
┌───▼──────────┐
│ Anthropic    │
│ Claude API   │
└──────────────┘
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Support

For issues and questions, please open a GitHub issue.

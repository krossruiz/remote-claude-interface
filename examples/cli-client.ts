/**
 * Example CLI client for Remote Claude API
 *
 * Usage:
 *   npm install
 *   npx ts-node examples/cli-client.ts
 */

import * as readline from 'readline';
import { RemoteClaudeClient } from '../client/client.js';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'your-api-key';

async function main() {
  console.log('Remote Claude CLI Client');
  console.log('========================\n');

  const client = new RemoteClaudeClient({
    baseUrl: API_URL,
    apiKey: API_KEY,
  });

  // Create a session
  console.log('Creating session...');
  const session = await client.createSession({
    client: 'cli',
    startedAt: new Date().toISOString(),
  });
  console.log(`Session created: ${session.sessionId}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You> ',
  });

  console.log('Type your messages (or /help for commands)\n');
  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      await handleCommand(client, session.sessionId, input);
      rl.prompt();
      return;
    }

    // Chat with Claude
    try {
      process.stdout.write('\nClaude> ');

      await client.chat(input, {
        sessionId: session.sessionId,
        stream: true,
        onToken: (token) => {
          process.stdout.write(token);
        },
        onComplete: () => {
          console.log('\n');
          rl.prompt();
        },
        onError: (error) => {
          console.error('\nError:', error.message);
          rl.prompt();
        },
      });
    } catch (error: any) {
      console.error('Error:', error.message);
      rl.prompt();
    }
  });

  rl.on('close', async () => {
    console.log('\nGoodbye!');
    await client.deleteSession(session.sessionId);
    process.exit(0);
  });
}

async function handleCommand(
  client: RemoteClaudeClient,
  sessionId: string,
  command: string,
): Promise<void> {
  const [cmd, ...args] = command.slice(1).split(' ');

  switch (cmd) {
    case 'help':
      console.log('\nAvailable commands:');
      console.log('  /help              - Show this help');
      console.log('  /clear             - Clear conversation history');
      console.log('  /history           - Show conversation history');
      console.log('  /read <path>       - Read a file');
      console.log('  /write <path>      - Write to a file (interactive)');
      console.log('  /ls <path>         - List files in directory');
      console.log('  /exec <command>    - Execute a terminal command');
      console.log('  /quit              - Exit the CLI');
      console.log('');
      break;

    case 'clear':
      await client.clearHistory(sessionId);
      console.log('Conversation history cleared.\n');
      break;

    case 'history':
      const history = await client.getHistory(sessionId);
      console.log('\nConversation History:');
      console.log('====================');
      history.forEach((msg: any, i: number) => {
        console.log(`${i + 1}. [${msg.role}]: ${msg.content.substring(0, 100)}...`);
      });
      console.log('');
      break;

    case 'read':
      if (!args[0]) {
        console.log('Usage: /read <path>\n');
        break;
      }
      try {
        const content = await client.readFile({ path: args[0] });
        console.log(`\nContent of ${args[0]}:`);
        console.log('==================');
        console.log(content);
        console.log('==================\n');
      } catch (error: any) {
        console.error(`Error reading file: ${error.message}\n`);
      }
      break;

    case 'write':
      if (!args[0]) {
        console.log('Usage: /write <path>\n');
        break;
      }
      console.log('Enter content (Ctrl+D when done):');
      const content: string[] = [];
      process.stdin.on('data', (chunk) => {
        content.push(chunk.toString());
      });
      process.stdin.once('end', async () => {
        try {
          await client.writeFile({
            path: args[0],
            content: content.join(''),
          });
          console.log(`File written: ${args[0]}\n`);
        } catch (error: any) {
          console.error(`Error writing file: ${error.message}\n`);
        }
      });
      break;

    case 'ls':
      const path = args[0] || '.';
      try {
        const files = await client.listFiles(path);
        console.log(`\nFiles in ${path}:`);
        console.log('==================');
        files.forEach((file: any) => {
          const type = file.isDirectory ? '[DIR]' : '[FILE]';
          console.log(`${type} ${file.name}`);
        });
        console.log('==================\n');
      } catch (error: any) {
        console.error(`Error listing files: ${error.message}\n`);
      }
      break;

    case 'exec':
      if (!args.length) {
        console.log('Usage: /exec <command>\n');
        break;
      }
      const execCommand = args.join(' ');
      console.log(`\nExecuting: ${execCommand}`);
      console.log('==================');
      try {
        await client.executeCommand({
          command: execCommand,
          stream: true,
          onStdout: (data) => process.stdout.write(data),
          onStderr: (data) => process.stderr.write(data),
        });
        console.log('==================\n');
      } catch (error: any) {
        console.error(`Error executing command: ${error.message}\n`);
      }
      break;

    case 'quit':
    case 'exit':
      console.log('Goodbye!');
      await client.deleteSession(sessionId);
      process.exit(0);
      break;

    default:
      console.log(`Unknown command: ${cmd}`);
      console.log('Type /help for available commands\n');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

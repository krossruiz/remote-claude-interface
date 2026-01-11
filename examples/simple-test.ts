/**
 * Simple test script to verify the API is working
 *
 * Usage:
 *   1. Start the server: npm run dev
 *   2. In another terminal: npx ts-node examples/simple-test.ts
 */

import { RemoteClaudeClient } from '../client/client.js';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'your-api-key';

async function runTests() {
  console.log('Remote Claude API - Simple Test Suite');
  console.log('=====================================\n');

  const client = new RemoteClaudeClient({
    baseUrl: API_URL,
    apiKey: API_KEY,
  });

  try {
    // Test 1: Create Session
    console.log('[TEST 1] Creating session...');
    const session = await client.createSession({ test: true });
    console.log(`✓ Session created: ${session.sessionId}\n`);

    // Test 2: Chat (non-streaming)
    console.log('[TEST 2] Testing chat (non-streaming)...');
    const response = await client.chat('Say "Hello, World!" and nothing else.', {
      sessionId: session.sessionId,
      stream: false,
    });
    console.log(`✓ Response: ${response.substring(0, 100)}...\n`);

    // Test 3: Chat (streaming)
    console.log('[TEST 3] Testing chat (streaming)...');
    let streamedResponse = '';
    await client.chat('Count from 1 to 5, one number per line.', {
      sessionId: session.sessionId,
      stream: true,
      onToken: (token) => {
        streamedResponse += token;
        process.stdout.write('.');
      },
    });
    console.log(`\n✓ Streamed response received (${streamedResponse.length} chars)\n`);

    // Test 4: File Operations
    console.log('[TEST 4] Testing file operations...');
    const testFilePath = 'test-file.txt';
    const testContent = 'Hello from Remote Claude API test!\n';

    // Write file
    await client.writeFile({
      path: testFilePath,
      content: testContent,
    });
    console.log(`✓ File written: ${testFilePath}`);

    // Read file
    const readContent = await client.readFile({ path: testFilePath });
    console.log(`✓ File read: ${readContent.trim()}`);

    // Edit file
    await client.editFile({
      path: testFilePath,
      oldString: 'Remote Claude API',
      newString: 'Remote Claude Interface API',
    });
    console.log('✓ File edited');

    // Read again to verify edit
    const editedContent = await client.readFile({ path: testFilePath });
    console.log(`✓ Verified edit: ${editedContent.trim()}`);

    // Check file exists
    const exists = await client.fileExists(testFilePath);
    console.log(`✓ File exists check: ${exists}`);

    // Get file info
    const info = await client.getFileInfo(testFilePath);
    console.log(`✓ File info: ${info.size} bytes`);

    // Delete file
    await client.deleteFile(testFilePath);
    console.log(`✓ File deleted\n`);

    // Test 5: Terminal Commands
    console.log('[TEST 5] Testing terminal commands...');
    const cmdResult = await client.executeCommand({
      command: 'echo "Hello from terminal"',
    });
    console.log(`✓ Command executed: ${cmdResult.stdout.trim()}`);
    console.log(`✓ Exit code: ${cmdResult.exitCode}\n`);

    // Test 6: List Directory
    console.log('[TEST 6] Testing directory listing...');
    const files = await client.listFiles('.');
    console.log(`✓ Found ${files.length} files/directories\n`);

    // Test 7: Session Management
    console.log('[TEST 7] Testing session management...');
    const sessions = await client.listSessions();
    console.log(`✓ Active sessions: ${sessions.length}`);

    // Clean up
    await client.deleteSession(session.sessionId);
    console.log(`✓ Session deleted\n`);

    // Success!
    console.log('=====================================');
    console.log('All tests passed! ✓');
    console.log('=====================================\n');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

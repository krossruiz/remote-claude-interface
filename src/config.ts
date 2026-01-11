import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
  security: {
    apiKey: process.env.API_KEY || '',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10),
  },
  claude: {
    workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  session: {
    timeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10),
  },
};

export function validateConfig() {
  const errors: string[] = [];

  if (!config.security.apiKey) {
    errors.push('API_KEY is required in .env file');
  }

  if (!config.claude.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY is required in .env file');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

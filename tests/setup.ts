import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'personalcrm-test-'));
process.env.DATABASE_URL = join(dir, 'test.sqlite');

import { config } from 'dotenv';
import { resolve } from 'node:path';

// The real key lives in backend/.env (gitignored) - the eval suite runs from
// the repo root, so it has to be pointed there explicitly.
config({ path: resolve(__dirname, '../backend/.env') });

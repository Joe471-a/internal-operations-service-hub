import { config } from 'dotenv';

// Reads backend/.env into process.env (locally - on Render there is no file,
// the dashboard's variables are already set). Imported first in main.ts so
// every module sees the values; quiet so the only lines in the logs are the
// backend's own JSON ones.
config({ quiet: true });

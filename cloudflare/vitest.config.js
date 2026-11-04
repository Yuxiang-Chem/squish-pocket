import {defineConfig} from 'vitest/config';
import {cloudflareTest} from '@cloudflare/vitest-plugin';
export default defineConfig({
  plugins:[cloudflareTest({wrangler:{configPath:'./wrangler.test.jsonc'}})],
  test:{include:['runtime-tests/**/*.test.js'],testTimeout:15000}
});

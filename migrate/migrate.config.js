import { defineConfig } from '@salomaosnff/migrate-tool'
import { MemoryStrategy } from './dist/strategies/in_memory.js';

export default defineConfig({
  strategy: new MemoryStrategy(), // Replace with your migration strategy instance
  migrations_dir: 'migrations',
  migrations_extension: '.js',
});


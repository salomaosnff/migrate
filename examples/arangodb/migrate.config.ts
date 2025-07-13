import { defineConfig } from '@salomaosnff/migrate'
import { ArangoDBStrategy } from '@salomaosnff/migrate-arango'

export default defineConfig({
  strategy: new ArangoDBStrategy({
    connection: {},
  }), // Replace with your migration strategy instance
  migrations_dir: 'migrations',
});


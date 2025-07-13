# @salomaosnff/migrate-arango

ArangoDB migration strategy for [@salomaosnff/migrate](https://github.com/salomaosnff/migrate) - A flexible database migration tool.

## Installation

```bash
npm install @salomaosnff/migrate-arango @salomaosnff/migrate arangojs
```

or with pnpm:

```bash
pnpm add @salomaosnff/migrate-arango @salomaosnff/migrate arangojs
```

## Usage

### Basic Setup

Create a `migrate.config.js` file in your project root:

```javascript
import { defineConfig } from '@salomaosnff/migrate';
import { ArangoDBStrategy } from '@salomaosnff/migrate-arango';

export default defineConfig({
  strategy: new ArangoDBStrategy({
    connection: {
      url: 'http://localhost:8529',
      databaseName: 'mydb',
      auth: {
        username: 'root',
        password: 'password'
      }
    }
  }),
  migrations_dir: './migrations'
});
```

### Configuration Options

The `ArangoDBStrategy` constructor accepts the following options:

```typescript
interface ArangoDBStrategyOptions {
  connection: ConfigOptions;           // ArangoDB connection configuration
  lock_collection?: string;            // Collection for migration locks (default: 'migrate_lock')
  changelog_collection?: string;       // Collection for migration history (default: 'migrate_changelog')
  migration_extension?: string;        // File extension for migrations (default: '.js')
}
```

#### Connection Configuration

The `connection` option uses ArangoDB's `ConfigOptions` interface. Common configuration options include:

```javascript
{
  url: 'http://localhost:8529',        // ArangoDB server URL
  databaseName: 'mydb',                // Database name
  auth: {
    username: 'root',                  // Username
    password: 'password'               // Password
  },
  agentOptions: {
    // Additional HTTP agent options
  }
}
```

For more connection options, refer to the [ArangoDB JavaScript driver documentation](https://github.com/arangodb/arangojs).

### Creating Migrations

Use the migration CLI to create new migrations:

```bash
npx migrate create create_users_collection
```

This will create a new migration file in your migrations directory with the following structure:

```javascript
// Migration file: 20250704162244497-create_users_collection
import { Database } from "arangojs";

export async function up(db: Database): Promise<void> {
  // Add your migration logic here for create_users_collection
}

export async function down(db: Database): Promise<void> {
  // Add your rollback logic here for create_users_collection
}
```

### Migration Examples

#### Creating a Collection

```javascript
import { Database } from "arangojs";

export async function up(db: Database): Promise<void> {
  // Create a new collection
  await db.createCollection('users');
  
  // Create an edge collection
  await db.createEdgeCollection('user_relationships');
}

export async function down(db: Database): Promise<void> {
  // Drop collections
  await db.collection('users').drop();
  await db.collection('user_relationships').drop();
}
```

#### Adding Indexes

```javascript
import { Database } from "arangojs";

export async function up(db: Database): Promise<void> {
  const users = db.collection('users');
  
  // Create a hash index on email field
  await users.createIndex({
    type: 'hash',
    fields: ['email'],
    unique: true
  });
  
  // Create a fulltext index on name field
  await users.createIndex({
    type: 'fulltext',
    fields: ['name']
  });
}

export async function down(db: Database): Promise<void> {
  const users = db.collection('users');
  
  // Drop indexes (you'll need to get the index identifiers)
  const indexes = await users.indexes();
  
  for (const index of indexes) {
    if (index.fields.includes('email') || index.fields.includes('name')) {
      await users.dropIndex(index);
    }
  }
}
```

#### Data Migration

```javascript
import { Database, aql } from "arangojs";

export async function up(db: Database): Promise<void> {
  // Insert initial data
  await db.query(aql`
    FOR i IN 1..100
    INSERT {
      _key: CONCAT('user_', i),
      name: CONCAT('User ', i),
      email: CONCAT('user', i, '@example.com'),
      createdAt: DATE_NOW()
    } INTO users
  `);
}

export async function down(db: Database): Promise<void> {
  // Remove the inserted data
  await db.query(aql`
    FOR user IN users
    FILTER user._key LIKE 'user_%'
    REMOVE user IN users
  `);
}
```

#### Custom Collections

You can customize the collection names used for tracking migrations:

```javascript
export default defineConfig({
  strategy: new ArangoDBStrategy({
    connection: {
      url: 'http://localhost:8529',
      databaseName: 'mydb',
      auth: { username: 'root', password: 'password' }
    },
    lock_collection: 'my_migration_locks',
    changelog_collection: 'my_migration_history'
  })
});
```

#### Different File Extensions

If you prefer TypeScript migration files:

```javascript
export default defineConfig({
  strategy: new ArangoDBStrategy({
    connection: {
      // ... connection config
    },
    migration_extension: '.ts'
  })
});
```

### Error Handling

The strategy implements proper error handling and will:

- Automatically lock migrations during execution to prevent concurrent runs
- Unlock migrations after completion or failure
- Maintain transaction integrity where possible
- Provide detailed error messages for debugging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Projects

- [@salomaosnff/migrate](https://github.com/salomaosnff/migrate) - The main migration framework
- [ArangoDB](https://www.arangodb.com/) - Multi-model database
- [arangojs](https://github.com/arangodb/arangojs) - JavaScript driver for ArangoDB
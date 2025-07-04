# @salomaosnff/migrate-tool

A flexible and extensible migration tool for Node.js applications, built with TypeScript and based on the Strategy pattern.

## 🚀 Installation

```bash
npm install @salomaosnff/migrate-tool
# or
yarn add @salomaosnff/migrate-tool
# or
pnpm add @salomaosnff/migrate-tool
```

## 📋 Features

- **Flexible**: Strategy-based system that allows implementing different types of migrations
- **TypeScript**: Fully typed for better development experience
- **CLI**: Command-line interface for ease of use
- **Locking**: Locking system to prevent simultaneous migration execution
- **Extensible**: Easy to create custom strategies

## 🎯 Core Concepts

### Migration Strategies

This library uses the Strategy pattern to support different types of migrations. A strategy defines how migrations are:

- Created
- Applied (up)
- Reverted (down)
- Stored/tracked
- Locked/unlocked

### Included Strategies

#### MemoryStrategy

A simple strategy that stores migration state in memory. Useful for testing and development.

```typescript
import { MemoryStrategy } from '@salomaosnff/migrate-tool'

const strategy = new MemoryStrategy()
```

## 🛠️ Configuration

### 1. Initialization

```bash
npx migrate init
```

This command creates a configuration file `migrate.config.ts` in the current directory.

### 2. Manual Configuration

Create a file `migrate.config.ts` in the root of your project:

```typescript
import { defineConfig, MemoryStrategy } from '@salomaosnff/migrate-tool'

export default defineConfig({
  strategy: new MemoryStrategy(),
  migrations_dir: 'migrations',
  migrations_extensions: ['.ts', '.js'],
})
```

### Configuration Options

| Option                  | Type                | Default        | Description                                 |
| ----------------------- | ------------------- | -------------- | ------------------------------------------- |
| `strategy`              | `MigrationStrategy` | -              | **Required**: Migration strategy to be used |
| `migrations_dir`        | `string`            | `'migrations'` | Directory where migration files are stored  |
| `migrations_extensions` | `string[]`          | `['.js']`      | File extensions accepted for migrations     |

## 📚 CLI Usage

### Available Commands

#### `migrate init`
Initializes the configuration file.

```bash
npx migrate init
# or with custom file
npx migrate init -c custom.config.ts
```

#### `migrate new <name>`
Creates a new migration.

```bash
npx migrate new create_users_table
```

#### `migrate up <name>`
Executes all pending migrations up to the specified migration.

```bash
npx migrate up
```

#### `migrate down <name>`
Reverts migrations down to (and including) the specified migration.

```bash
npx migrate down create_users_table
```

#### `migrate rollback`
Reverts only the last applied migration.

```bash
npx migrate rollback
```

### Global Options

| Option                | Description                    |
| --------------------- | ------------------------------ |
| `-c, --config <path>` | Path to the configuration file |

## 🔧 Programmatic Usage

### Basic Example

```typescript
import { Migrator, defineConfig } from '@salomaosnff/migrate-tool'
import { MemoryStrategy } from '@salomaosnff/migrate-tool'

const config = defineConfig({
  strategy: new MemoryStrategy(),
  migrations_dir: './migrations',
  migrations_extensions: ['.ts']
})

const migrator = new Migrator(config)

// Initialize
await migrator.init()

// Create a new migration
await migrator.create('add_users_table')

// Execute pending migrations
await migrator.latest()

// Get current migration
const current = await migrator.getCurrent()
console.log('Current migration:', current)

// Get pending migrations
const pending = await migrator.getPendingMigrations()
console.log('Pending migrations:', pending)

// Revert last migration
await migrator.rollback()

// Clean up resources
await migrator.destroy()
```

### Migrator Methods

#### `init(): Promise<void>`
Initializes the migrator and sets up the strategy.

#### `destroy(): Promise<void>`
Cleans up resources and finalizes the strategy.

#### `create(name: string): Promise<string>`
Creates a new migration with the specified name.

#### `latest(): Promise<void>`
Executes all pending migrations.

#### `up(migration: string): Promise<void>`
Executes migrations up to the specified migration.

#### `down(migration: string): Promise<void>`
Reverts migrations down to the specified migration.

#### `rollback(): Promise<void>`
Reverts only the last applied migration.

#### `revertAll(): Promise<void>`
Reverts all applied migrations.

#### `getCurrent(): Promise<string | null>`
Returns the name of the last applied migration.

#### `getPendingMigrations(): Promise<string[]>`
Returns a list of pending migrations.

## 🏗️ Creating Custom Strategies

To create a custom strategy, implement the `MigrationStrategy` interface:

```typescript
import { MigrationStrategy, Config } from '@salomaosnff/migrate-tool'

export class CustomStrategy implements MigrationStrategy {
  async setup(config: Required<Config>): Promise<void> {
    // Initial strategy setup
  }

  async destroy(config: Required<Config>): Promise<void> {
    // Resource cleanup
  }

  async createMigrationFile(config: Required<Config>, migration: string): Promise<string> {
    // Return migration file content
    return `
export async function up() {
  // Implement migration logic here
}

export async function down() {
  // Implement rollback logic here
}
`
  }

  async up(config: Required<Config>, name: string, migrationPath: string): Promise<void> {
    // Execute migration
    const migration = await import(migrationPath)
    await migration.up()
    // Register migration as applied
  }

  async down(config: Required<Config>, name: string, migrationPath: string): Promise<void> {
    // Revert migration
    const migration = await import(migrationPath)
    await migration.down()
    // Remove migration from registry
  }

  async lock(config: Required<Config>, id: string): Promise<void> {
    // Lock migration
  }

  async unlock(config: Required<Config>, id: string): Promise<void> {
    // Unlock migration
  }

  async isLocked(config: Required<Config>, id: string): Promise<boolean> {
    // Check if migration is locked
    return false
  }

  async getLatestMigrationName(config: Required<Config>): Promise<string | null> {
    // Return name of latest applied migration
    return null
  }

  getMigrationFileName(config: Required<Config>, migration: string): string {
    // Generate migration filename
    return `${Date.now()}_${migration}${config.migrations_extensions[0]}`
  }
}
```

### MigrationStrategy Interface

#### Required Methods

- `createMigrationFile(config, migration)`: Creates migration file content
- `up(config, name, migrationPath)`: Executes a migration
- `down(config, name, migrationPath)`: Reverts a migration
- `lock(config, id)`: Locks a migration
- `unlock(config, id)`: Unlocks a migration
- `isLocked(config, id)`: Checks if a migration is locked
- `getLatestMigrationName(config)`: Returns the latest applied migration

#### Optional Methods

- `setup(config)`: Initial strategy setup
- `destroy(config)`: Resource cleanup
- `getMigrationFileName(config, migration)`: Generates migration filename

## 📝 Migration File Structure

Migration files should export two functions:

```typescript
export async function up() {
  // Logic to apply the migration
  console.log('Applying migration...')
}

export async function down() {
  // Logic to revert the migration
  console.log('Reverting migration...')
}
```

## 🔒 Locking System

The locking system prevents simultaneous migration execution, ensuring data integrity:

- Each migration is locked before execution
- The lock is automatically removed after execution
- If a migration fails, the lock is removed
- Attempts to execute locked migrations result in an error

## 🌟 Usage Examples

### Database Example

```typescript
// database-strategy.ts
import { MigrationStrategy, Config } from '@salomaosnff/migrate-tool'
import { Database } from 'your-database-library'

export class DatabaseStrategy implements MigrationStrategy {
  private db: Database

  constructor(database: Database) {
    this.db = database
  }

  async setup(config: Required<Config>): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  async getLatestMigrationName(): Promise<string | null> {
    const result = await this.db.query(
      'SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 1'
    )
    return result[0]?.name || null
  }

  async up(config: Required<Config>, name: string, migrationPath: string): Promise<void> {
    const migration = await import(migrationPath)
    await migration.up(this.db)
    await this.db.execute(
      'INSERT INTO migrations (name) VALUES (?)',
      [name]
    )
  }

  async down(config: Required<Config>, name: string, migrationPath: string): Promise<void> {
    const migration = await import(migrationPath)
    await migration.down(this.db)
    await this.db.execute(
      'DELETE FROM migrations WHERE name = ?',
      [name]
    )
  }

  // ... implement other methods
}
```

### Database Configuration

```typescript
// migrate.config.ts
import { defineConfig } from '@salomaosnff/migrate-tool'
import { DatabaseStrategy } from './database-strategy'
import { createDatabase } from 'your-database-library'

const database = createDatabase({
  host: 'localhost',
  database: 'myapp',
  // ... other options
})

export default defineConfig({
  strategy: new DatabaseStrategy(database),
  migrations_dir: 'database/migrations',
  migrations_extensions: ['.ts']
})
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -am 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔧 Development

### Environment Setup

```bash
# Clone the repository
git clone https://github.com/salomaosnff/migrate-tool.git

# Install dependencies
pnpm install

# Build
pnpm build

# Test locally
pnpm link --global
```

### Project Structure

```
src/
├── cli/            # Command-line interface
├── core/           # Core logic
│   ├── migrator.ts # Main migrator class
│   └── strategy.ts # Strategy interface
├── strategies/     # Migration strategies
├── config.ts       # Configuration
└── index.ts        # Main exports
```
## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Salomão Neto** - [contato@sallon.dev](mailto:contato@sallon.dev)

---

## 📈 Roadmap

- [ ] Automated tests
- [ ] PostgreSQL Strategy
- [ ] MongoDB Strategy
- [ ] ArangoDB Strategy
- [ ] Shell Script Strategy

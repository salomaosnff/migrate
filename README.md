# Migrate Monorepo

This monorepo contains a flexible migration system for Node.js applications with support for multiple database strategies.

## 📦 Packages

### [@salomaosnff/migrate](./migrate/README.md)
The core migration - A flexible and extensible migration tool built with TypeScript using the Strategy pattern.

### [@salomaosnff/migrate-arango](./migrate-arango/README.md)
ArangoDB migration strategy for the core migration.

## 🚀 Quick Start

### Installation

```bash
# Install the core migration tool
npm install @salomaosnff/migrate

# Install ArangoDB strategy (if using ArangoDB)
npm install @salomaosnff/migrate-arango arangojs
```

### Basic Usage

1. **Initialize configuration**:
   ```bash
   npx migrate init
   ```

2. **Configure your strategy** in `migrate.config.ts`:
   ```typescript
   import { defineConfig } from '@salomaosnff/migrate';
   import { ArangoDBStrategy } from '@salomaosnff/migrate-arango';

   export default defineConfig({
     strategy: new ArangoDBStrategy({
       connection: {
         url: 'http://localhost:8529',
         databaseName: 'mydb'
       }
     }),
     migrations_dir: './migrations'
   });
   ```

3. **Create a migration**:
   ```bash
   npx migrate create create_users_table
   ```

4. **Run migrations**:
   ```bash
   npx migrate latest
   ```

## 🏗️ Architecture

The migration system uses the **Strategy Pattern** to support different database implementations:

```
┌─────────────────┐
│   CLI Tool      │
└─────────────────┘
         │
┌─────────────────┐
│   Migrator      │ ← Core migration logic
└─────────────────┘
         │
┌─────────────────┐
│   Strategy      │ ← Database-specific implementation
└─────────────────┘
```

### Core Components

- **Migrator**: Manages the migration lifecycle and orchestrates strategy operations
- **Strategy**: Interface defining how migrations are stored, applied, and tracked
- **Config**: Configuration system for setting up migration behavior

## 🔧 Development

### Prerequisites

- Node.js 18+
- pnpm (recommended package manager)

### Setup

```bash
# Clone the repository
git clone https://github.com/salomaosnff/migrate.git
cd migrate

# Install dependencies
pnpm install

# Build all packages
pnpm -r build
```

### Project Structure

```
migrate/
├── migrate/                 # Core migration framework
│   ├── src/
│   │   ├── cli/            # Command-line interface
│   │   ├── core/           # Core migration logic
│   │   │   ├── migrator.ts # Main migrator class
│   │   │   └── strategy.ts # Strategy interface
│   │   ├── config.ts       # Configuration system
│   │   └── index.ts        # Public API exports
│   └── package.json
├── migrate-arango/          # ArangoDB strategy
│   ├── src/
│   │   └── index.ts        # ArangoDB strategy implementation
│   └── package.json
└── package.json            # Monorepo root
```

## 📚 Available Strategies

### Built-in Strategies

- **MemoryStrategy**: In-memory storage for testing and development
- **ArangoDBStrategy**: ArangoDB implementation with full migration support

### Creating Custom Strategies

Implement the `MigrationStrategy` interface:

```typescript
import { MigrationStrategy, Config, MigrationFile, MigrationApply } from '@salomaosnff/migrate';

export class CustomStrategy implements MigrationStrategy {
  async setup(config: Required<Config>): Promise<void> {
    // Initialize your database connection
  }

  async destroy(): Promise<void> {
    // Clean up connections
  }

  async createMigration(migration: MigrationFile): Promise<string> {
    // Return migration file template
    return `
export async function up() {
  // Migration logic
}

export async function down() {
  // Rollback logic
}
`;
  }

  async up(migration: MigrationApply): Promise<void> {
    // Apply migration
  }

  async down(migration: MigrationFile): Promise<void> {
    // Rollback migration
  }

  // ... implement other required methods
}
```

## 📦 Publishing

```bash
# Build all packages
pnpm -r build

# Publish all packages
pnpm -r publish
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all packages build successfully

## 📄 License

This project is licensed under the MIT License - see the individual package LICENSE files for details.

## 🔗 Links

- [Core Package Documentation](./migrate/README.md)
- [ArangoDB Strategy Documentation](./migrate-arango/README.md)
- [GitHub Repository](https://github.com/salomaosnff/migrate)
- [npm Package - Core](https://www.npmjs.com/package/@salomaosnff/migrate)
- [npm Package - ArangoDB](https://www.npmjs.com/package/@salomaosnff/migrate-arango)

## 📧 Support

For questions and support, please open an issue on the GitHub repository or contact the maintainer at contato@sallon.dev.

import { dirname, join, relative } from "node:path";
import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { Config } from "../config";
import { MigrationFile, MigrationApply } from "./strategy";
import { existsSync } from "node:fs";

function fileWithoutExtension(fileName: string): string {
  return fileName.split('.').slice(0, -1).join('.');
}

export class Migrator {
  #config: Required<Config>

  constructor(config: Required<Config>) {
    this.#config = config
  }

  /**
   * Initializes the migrator and prepares the migration strategy.
   */
  async setup() {
    await this.#config.strategy?.setup?.(this.#config)
  }

  /**
   * Destroys the migrator and cleans up resources.
   * This method is typically used to release any locks or connections held by the migration strategy.
   * It should be called when the migrator is no longer needed, such as when the application is shutting down.
   */
  async destroy() {
    await this.#config.strategy?.destroy?.();
  }

  /**
   * Retrieves the name of the latest migration that has been applied.
   * @returns The name of the latest migration or null if no migrations have been applied.
   */
  async getCurrent(): Promise<string | null> {
    return this.#config.strategy.getLatestMigrationName();
  }

  async #getMigrations(): Promise<MigrationFile[]> {
    if (this.#config.strategy.readLocalMigrations) {
      return this.#config.strategy.readLocalMigrations(this.#config.migrations_dir);
    }

    const migrations: MigrationFile[] = [];

    for (const entry of await readdir(this.#config.migrations_dir, { withFileTypes: true, recursive: false })) {
      migrations.push({
        name: entry.name,
        filepath: join(entry.parentPath, entry.name),
      });
    }

    return migrations.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Retrieves a list of pending migrations that have not yet been applied.
   * This method compares the list of available migrations in the migrations directory with the latest applied migration
   * to determine which migrations are pending.
   * @returns 
   */
  async getPendingMigrations(): Promise<MigrationFile[]> {
    const latestAppliedMigration = await this.#config.strategy.getLatestMigrationName();
    const queue: MigrationFile[] = await this.#getMigrations();

    if (!latestAppliedMigration) {
      return queue
    }

    const latestIndex = queue.findIndex(migration => migration.name === latestAppliedMigration);

    if (latestIndex === -1) {
      throw new Error(`Latest migration "${latestAppliedMigration}" not found in the migrations directory.`);
    }

    return queue.slice(latestIndex + 1);
  }

  async #lockMigration(migration: MigrationFile, cb: () => Promise<void>): Promise<void> {
    if (await this.#config.strategy.isLocked(migration)) {
      throw new Error(`Migration "${migration.name}" is already locked.`);
    }

    try {
      await this.#config.strategy.lock(migration);
      await cb();
    } finally {
      await this.#config.strategy.unlock(migration);
    }
  }

  async #applyMigration(migration: MigrationFile, batch_date?: Date): Promise<void> {
    await this.#lockMigration(migration, async () => {
      const apply_date = new Date();
      await this.#config.strategy.up({
        ...migration,
        batch_date: batch_date ?? new Date(),
        apply_date: new Date(),
      });
      console.log(`Migration "${migration.name}" applied successfully.`);
    })
  }

  async #rollbackMigration(migration: MigrationFile): Promise<void> {
    await this.#lockMigration(migration, async () => {
      await this.#config.strategy.down(migration);
      console.log(`Migration "${migration.name}" reverted successfully.`);
    })
  }

  /**
   * Executes all pending migrations up to <migration_name> in chronological order
   * @param name Migration name to stop at. If not provided, it will apply the first pending migration.
   */
  async up(name?: string): Promise<void> {
    const batch_date = new Date();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to apply.");
      return;
    }

    name ||= pendingMigrations[0].name; // Default to the first pending migration if none is specified

    for (const migration of pendingMigrations) {
      await this.#applyMigration(migration, batch_date);

      if (migration.name === name) {
        break; // Stop if we reach the specified migration
      }
    }
  }

  /**
   * Executes all pending migrations in chronological order
   * This method applies all migrations that have not yet been executed, starting from the earliest pending migration
   * and proceeding to the latest.
   * It is useful for bringing the database schema up to date with the latest migrations.
   * @returns 
   */
  async latest(): Promise<void> {
    const batch_date = new Date();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to apply.");
      return;
    }

    for (const migration of pendingMigrations) {
      await this.#applyMigration(migration, batch_date);
    }
  }

  /**
   * Reverts all migrations down to <migration_name> in reverse chronological order
   * @param name Migration name to revert to. If not provided, it will revert to the latest applied migration.
   */
  async down(name?: string): Promise<void> {
    const latestAppliedMigration = await this.#config.strategy.getLatestMigrationName();

    if (!latestAppliedMigration) {
      throw new Error("No migrations have been applied yet.");
    }

    name ||= latestAppliedMigration; // Default to the latest applied migration if none is specified

    const allMigrations = await this.#getMigrations();
    const latestIndex = allMigrations.findIndex(m => m.name === latestAppliedMigration);
    const targetIndex = allMigrations.findIndex(m => m.name === name);

    if (targetIndex === -1) {
      throw new Error(`Migration "${name}" not found in the migrations directory.`);
    }

    if (targetIndex > latestIndex) {
      throw new Error(`Cannot revert to migration "${name}" as it is newer than the latest applied migration "${latestAppliedMigration}".`);
    }

    for (let i = allMigrations.length - 1; i >= targetIndex; i--) {
      const migration = allMigrations[i];

      await this.#lockMigration(migration, async () => {
        await this.#config.strategy.down(migration);
        console.log(`Migration "${name}" reverted successfully.`);
      });
    }
  }

  /**
   * Revert all migrations
   */
  async revertAll(): Promise<void> {
    const latestAppliedMigration = await this.#config.strategy.getLatestMigrationName();

    if (!latestAppliedMigration) {
      throw new Error("No migrations have been applied yet.");
    }

    const allMigrations = await this.#getMigrations();

    for (let i = allMigrations.length - 1; i >= 0; i--) {
      const migration = allMigrations[i];

      await this.#lockMigration(migration, async () => {
        await this.#config.strategy.down(migration);
        console.log(`Migration "${migration.name}" reverted successfully.`);
      });
    }
  }

  async create(migrationName: string): Promise<string> {
    const migrationFileName = this.#config.strategy.getMigrationFileName(migrationName);
    const migrationFilePath = join(this.#config.migrations_dir, migrationFileName);

    const createMigrationResult = await this.#config.strategy.createMigration({
      name: migrationFileName,
      filepath: migrationFilePath,
    });

    let migrationFiles: { filename: string; content: string }[] = [];

    if (typeof createMigrationResult === 'string') {
      migrationFiles.push({
        filename: migrationFileName,
        content: createMigrationResult,
      });
    } else if (Array.isArray(createMigrationResult)) {
      for (const item of createMigrationResult) {
        if (typeof item === 'string') {
          migrationFiles.push({
            filename: migrationFileName,
            content: item,
          });
        } else {
          migrationFiles.push(item);
        }
      }
    } else {
      migrationFiles.push({
        filename: migrationFileName,
        content: createMigrationResult,
      });
    }

    for (const migrationFile of migrationFiles) {
      const filePath = join(this.#config.migrations_dir, migrationFile.filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, migrationFile.content, 'utf8');
      console.log(`Migration file created: "${relative(process.cwd(), filePath)}"`);
    }

    return migrationFilePath;
  }

  async rollback(): Promise<void> {
    const latestBatchDate = await this.#config.strategy.getLatestBatchDate();

    if (!latestBatchDate) {
      console.log("No migrations have been applied yet.");
      return;
    }

    const latestBatch = await this.#config.strategy.getBatch(latestBatchDate);

    if (latestBatch.length === 0) {
      console.log("No migrations to rollback in the latest batch.");
      return;
    }

    const migrations: MigrationFile[] = [];

    for (const migrationName of latestBatch) {
      const migrationFilePath = join(this.#config.migrations_dir, migrationName);

      if (!existsSync(migrationFilePath)) {
        console.error(`Migration file "${relative(process.cwd(), migrationFilePath)}" is missing.`);
        return;
      }

      migrations.push({
        name: migrationName,
        filepath: migrationFilePath,
      });
    }

    for (let i = migrations.length - 1; i >= 0; i--) {
      await this.#rollbackMigration(migrations[i]);
    }
  }
}
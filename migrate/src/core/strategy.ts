import { Config } from "../config";

export interface MigrationFile {
  /**
   * The name of the migration to apply.
   * This should match the filename of the migration script without the extension.
   * For example, if the migration file is `20231001_create_users_table.js`,
   * the name should be `20231001_create_users_table`.
   */
  name: string;

  /**
   * The path to the migration file.
   * This is the full path to the migration script that will be executed.
   */
  filepath: string;
}

export interface MigrationApply extends MigrationFile {
  /**
   * The date when the migration was applied.
   */
  apply_date: Date;

  /**
   * The batch date when the migration was applied.
   */
  batch_date: Date;
}

export interface MigrationStrategy {

  /**
   * Setup the migration strategy.
   * @param config 
   */
  setup?(config: Required<Config>): Promise<void>;

  /**
   * Destroy the migration strategy.
   */
  destroy?(): Promise<void>;

  /**
   * Read local migrations from the specified directory.
   * This method should read all migration files in the specified directory
   * and return an array of MigrationFile objects.
   * Each MigrationFile object should contain the name and filepath of the migration.
   * The migration files should be sorted in chronological order based on their filenames.
   * @param migration_dir 
   */
  readLocalMigrations?(migration_dir: string): Promise<MigrationFile[]>;

  /**
   * Create a new migration file.
   * This method should generate a new migration file based on the provided migration object.
   * @param migration 
   */
  createMigration(migration: MigrationFile): Promise<Array<{
    filename: string;
    content: string;
  } | string> | string>;

  /**
   * Apply a migration file
   * @param migration 
   */
  up(migration: MigrationApply): Promise<void>;

  /**
   * Revert a migration file
   * @param migration 
   */
  down(migration: MigrationFile): Promise<void>;

  /**
   * Lock a migration
   * @param migration 
   */
  lock(migration: MigrationFile): Promise<void>;

  /**
   * Unlock a migration by its ID.
   * @param migration 
   */
  unlock(migration: MigrationFile): Promise<void>;

  /**
   * Check if a migration is locked by its ID.
   * @param id 
   */
  isLocked(migration: MigrationFile): Promise<boolean>;

  /**
   * Get the date of the latest batch of migrations.
   * This method should return the date of the most recent batch of migrations that have been applied
   * @returns {Promise<Date | null>} Date of the latest batch.
   */
  getLatestBatchDate(): Promise<Date | null>;

  /**
   * Get the batch of migrations that have been applied on a specific batch date.
   * @param batch_date 
   */
  getBatch(batch_date: Date): Promise<string[]>;

  /**
   * Generate a migration filename based on the migration name.
   * The filename should follow a consistent naming convention,
   * such as `YYYYMMDD_HHMMSS_migration_name.js`,
   * unique, descriptive, and without parent directories.
   * The order of migrations is determined by filename sorting.
   * @param migrationName The name of the migration.
   * @returns {string} The generated migration filename.
   */
  getMigrationFileName(migrationName: string): string

  /**
   * Returns the latest applied migration name.
   * @returns {Promise<string | null>} The name of the latest applied migration or null if no migrations have been applied.
   */
  getLatestMigrationName(): Promise<string | null>;
}
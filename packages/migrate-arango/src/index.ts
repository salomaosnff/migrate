import { join } from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";

import { Config, MigrationApply, MigrationFile, MigrationStrategy } from "@salomaosnff/migrate";

import { aql, Database } from "arangojs";
import { DocumentCollection } from "arangojs/collections";
import { ConfigOptions } from "arangojs/configuration";

import { transform } from "esbuild";
import { tmpdir } from "node:os";

export interface ArangoDBStrategyOptions {
  connection: ConfigOptions;
  lock_collection?: string;
  changelog_collection?: string;
  migration_extension?: string;
}

export class ArangoDBStrategy implements MigrationStrategy {
  #db: Database;
  #strategy_config: Required<ArangoDBStrategyOptions>;
  #changelog: DocumentCollection;
  #lock: DocumentCollection;

  constructor(options: ArangoDBStrategyOptions) {
    options.lock_collection ??= "migrate_lock";
    options.changelog_collection ??= "migrate_changelog";
    options.migration_extension ??= ".ts";

    this.#db = new Database(options.connection);
    this.#strategy_config = options as Required<ArangoDBStrategyOptions>;
    this.#changelog = this.#db.collection(this.#strategy_config.changelog_collection);
    this.#lock = this.#db.collection(this.#strategy_config.lock_collection);
  }

  async #execScript(script: string): Promise<any> {
    const configTransformed = await transform(await readFile(script, 'utf8'), {
      loader: 'ts',
      format: 'cjs',
      target: 'es2024',
      platform: 'node',
      sourcemap: false,
      keepNames: true
    })

    if (configTransformed.warnings.length > 0) {
      console.group('Warnings during script transformation:');
      for (const warning of configTransformed.warnings) {
        console.warn(warning.text);
      }
      console.groupEnd();
    }
    const transformedConfigPath = join(process.cwd(), 'tmp.migration.js')
    await writeFile(transformedConfigPath, configTransformed.code, 'utf8')
    const { default: res } = await import(transformedConfigPath)
    await rm(transformedConfigPath, { force: true })

    return res
  }

  async setup(config: Required<Config>): Promise<void> {
    if (!await this.#db.exists()) {
      throw new Error("Database does not exist. Please check your connection settings.");
    }

    if (!await this.#changelog.exists()) {
      await this.#db.createCollection(this.#strategy_config.changelog_collection);
    }

    if (!await this.#lock.exists()) {
      await this.#db.createCollection(this.#strategy_config.lock_collection);
    }
  }


  async destroy(): Promise<void> {
    this.#db.close();
  }

  async createMigration(migration: MigrationFile): Promise<Array<{ filename: string; content: string; } | string> | string> {
    if (this.#strategy_config.migration_extension === ".ts") {
      return [
        `// Migration file: ${migration.name}`,
        'import { Database } from "arangojs";',
        '',
        '/**',
        ' * @param db - The ArangoDB database instance.',
        ' * @returns {Promise<void>} - A promise that resolves when the migration is applied.',
        ' */',
        'export async function up(db: Database): Promise<void> {',
        `  // Insert logic here to apply the migration`,
        '}',
        '',
        '/**',
        ' * @param db - The ArangoDB database instance.',
        ' * @returns {Promise<void>} - A promise that resolves when the migration is rolled back.',
        ' */',
        'export async function down(db: Database): Promise<void> {',
        `  // Insert logic here to rollback the migration`,
        '}',
        '',
      ].join("\n");
    }

    if (this.#strategy_config.migration_extension === ".mjs") {
      return [
        `// Migration file: ${migration.name}`,
        'import { Database } from "arangojs";',
        '',
        '/**',
        ' * @param {Database} db - The ArangoDB database instance.',
        ' * @returns {Promise<void>} - A promise that resolves when the migration is applied.',
        ' */',
        'export async function up(db) {',
        `  // Insert logic here to apply the migration`,
        '}',
        '',
        '/**',
        ' * @param {Database} db - The ArangoDB database instance.',
        ' * @returns {Promise<void>} - A promise that resolves when the migration is rolled back.',
        ' */',
        'export async function down(db) {',
        `  // Insert logic here to rollback the migration`,
        '}',
      ].join("\n");
    }

    if (this.#strategy_config.migration_extension === ".js") {
      return [
        `// Migration file: ${migration.name}`,
        'const { Database } = require("arangojs");',
        '',
        'module.exports = {',
        '  /**',
        '   * @param {Database} db - The ArangoDB database instance.',
        '   * @returns {Promise<void>} - A promise that resolves when the migration is applied.',
        '   */',
        '  async up(db) {',
        '    // Insert logic here to apply the migration',
        '  },',
        '',
        '  /**',
        '   * @param {Database} db - The ArangoDB database instance.',
        '   * @returns {Promise<void>} - A promise that resolves when the migration is rolled back.',
        '   */',
        '  async down(db) {',
        '    // Insert logic here to rollback the migration',
        '  }',
        '};',
      ].join("\n");
    }

    throw new Error(`Unsupported migration extension: ${this.#strategy_config.migration_extension}! Supported extensions are: .ts, .mjs, .js`);
  }

  async up(migration: MigrationApply): Promise<void> {
    const { up } = await this.#execScript(migration.filepath);

    if (typeof up !== 'function') {
      throw new Error(`Migration file ${migration.filepath} does not export an 'up' function.`);
    }

    await up(this.#db);

    await this.#db.query(aql`
      INSERT {
        name: ${migration.name},
        batch_date: ${migration.batch_date},
        apply_date: ${migration.apply_date},
      } INTO ${this.#changelog}
    `)
  }


  async down(migration: MigrationFile): Promise<void> {
    const { down } = await this.#execScript(migration.filepath);

    if (typeof down !== 'function') {
      throw new Error(`Migration file ${migration.filepath} does not export a 'down' function.`);
    }

    await down(this.#db);

    await this.#db.query(aql`
      FOR doc IN ${this.#changelog}
      FILTER doc.name == ${migration.name}
      REMOVE doc IN ${this.#changelog}
    `);
  }

  async lock(migration: MigrationFile): Promise<void> {
    await this.#db.query(aql`INSERT { name: ${migration.name}, locked_at: DATE_NOW() } INTO ${this.#db.collection(this.#strategy_config.lock_collection)}`)
  }

  async unlock(migration: MigrationFile): Promise<void> {
    await this.#db.query(aql`FOR lock IN ${this.#lock}
      FILTER lock.name == ${migration.name}
      REMOVE lock IN ${this.#lock}
    `);
  }

  async isLocked(migration: MigrationFile): Promise<boolean> {
    const cursor = await this.#db.query(aql`FOR lock IN ${this.#lock}
      FILTER lock.name == ${migration.name}
      LIMIT 1
      RETURN lock
    `);

    return cursor.hasNext;
  }

  async getLatestBatchDate(): Promise<Date | null> {
    const cursor = await this.#db.query(aql`FOR doc IN ${this.#changelog}
      SORT doc.batch_date DESC
      LIMIT 1
      RETURN doc.batch_date
    `);

    const result = await cursor.next();
    return result ? new Date(result) : null;
  }

  async getBatch(batch_date: Date): Promise<string[]> {
    const cursor = await this.#db.query(aql`FOR doc IN ${this.#changelog}
      FILTER doc.batch_date == ${batch_date}
      RETURN doc.name
    `);

    return cursor.all();
  }

  getMigrationFileName(migrationName: string): string {
    return `${new Date().toISOString().replaceAll(/\D/g, '')}-${migrationName}${this.#strategy_config.migration_extension}`;
  }

  async getLatestMigrationName(): Promise<string | null> {
    const cursor = await this.#db.query(aql`FOR doc IN ${this.#changelog}
      SORT doc.batch_date DESC
      LIMIT 1
      RETURN doc.name
    `);

    const result = await cursor.next();

    return result || null;
  }
}
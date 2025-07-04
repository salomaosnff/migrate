import { Config, MigrationApply, MigrationFile, MigrationStrategy } from "@salomaosnff/migrate";
import { aql, Database } from "arangojs";
import { ConfigOptions } from "arangojs/configuration";

export interface ArangoDBStrategyOptions {
  connection: ConfigOptions;
  lock_collection?: string;
  changelog_collection?: string;
  migration_extension?: string;
}

export class ArangoDBStrategy implements MigrationStrategy {
  #db: Database;
  #strategy_config: Required<ArangoDBStrategyOptions>;

  constructor(options: ArangoDBStrategyOptions) {
    options.lock_collection ??= "migrate_changelog";
    options.changelog_collection ??= "migrate_lock";
    options.migration_extension ??= ".js";

    this.#db = new Database(options.connection);
    this.#strategy_config = options as Required<ArangoDBStrategyOptions>;
  }

  async setup(config: Required<Config>): Promise<void> {
    await this.#db.get()
  }


  async destroy(): Promise<void> {
    this.#db.close();
  }

  async createMigration(migration: MigrationFile): Promise<Array<{ filename: string; content: string; } | string> | string> {
    return [
      `// Migration file: ${migration.name}`,
      'import { Database } from "arangojs";',
      '',
      'export async function up(db: Database): Promise<void> {',
      `  // Add your migration logic here for ${migration.name}`,
      '}',
      '',
      'export async function down(db: Database): Promise<void> {',
      `  // Add your rollback logic here for ${migration.name}`,
      '}',
      '',
    ].join("\n");
  }

  async up(migration: MigrationApply): Promise<void> {
    const { up } = await import(migration.filepath);

    if (typeof up !== 'function') {
      throw new Error(`Migration file ${migration.filepath} does not export an 'up' function.`);
    }

    await up(this.#db);

    await this.#db.query(aql`
      INSERT {
        name: ${migration.name},
        batch_date: ${migration.batch_date},
        apply_date: ${migration.apply_date},
      } INTO ${this.#db.collection(this.#strategy_config.changelog_collection)}
    `)
  }


  async down(migration: MigrationFile): Promise<void> {
    const { down } = await import(migration.filepath);

    if (typeof down !== 'function') {
      throw new Error(`Migration file ${migration.filepath} does not export a 'down' function.`);
    }

    await down(this.#db);

    await this.#db.query(aql`
      REMOVE {
        name: ${migration.name}
      } IN ${this.#db.collection(this.#strategy_config.changelog_collection)}
    `);
  }

  async lock(migration: MigrationFile): Promise<void> {
    await this.#db.query(aql`INSERT { name: ${migration.name}, locked_at: DATE_NOW() } INTO ${this.#db.collection(this.#strategy_config.lock_collection)}`)
  }

  async unlock(migration: MigrationFile): Promise<void> {
    const collection = this.#db.collection(this.#strategy_config.lock_collection);

    await this.#db.query(aql`FOR lock IN ${collection}
      FILTER lock.name == ${migration.name}
      REMOVE lock IN ${collection}
    `);
  }

  async isLocked(migration: MigrationFile): Promise<boolean> {
    const collection = this.#db.collection(this.#strategy_config.lock_collection);
    const cursor = await this.#db.query(aql`FOR lock IN ${collection}
      FILTER lock.name == ${migration.name}
      LIMIT 1
      RETURN lock
    `);

    return cursor.hasNext;
  }

  async getLatestBatchDate(): Promise<Date | null> {
    const collection = this.#db.collection(this.#strategy_config.changelog_collection);
    const cursor = await this.#db.query(aql`FOR doc IN ${collection}
      SORT doc.batch_date DESC
      LIMIT 1
      RETURN doc.batch_date
    `);

    const result = await cursor.next();
    return result ? new Date(result) : null;
  }

  async getBatch(batch_date: Date): Promise<string[]> {
    const collection = this.#db.collection(this.#strategy_config.changelog_collection);
    const cursor = await this.#db.query(aql`FOR doc IN ${collection}
      FILTER doc.batch_date == ${batch_date}
      RETURN doc.name
    `);

    return cursor.all();
  }

  getMigrationFileName(migrationName: string): string {
    return `${migrationName}${this.#strategy_config.migration_extension}`;
  }

  async getLatestMigrationName(): Promise<string | null> {
    const collection = this.#db.collection(this.#strategy_config.changelog_collection);
    const cursor = await this.#db.query(aql`FOR doc IN ${collection}
      SORT doc.batch_date DESC
      LIMIT 1
      RETURN doc.name
    `);

    const result = await cursor.next();

    return result || null;
  }
}
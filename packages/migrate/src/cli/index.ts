#!/usr/bin/env node
import { program } from 'commander'
import { Migrator } from '../core/migrator.js'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { transform } from 'esbuild'
import { tmpdir } from 'os'

async function createMigrator(configFile: string, cb: (mig: Migrator) => any): Promise<void> {
  if (!configFile) {
    for (const file of [
      'migrate.config.js',
      'migrate.config.ts',
      'migrate.config.mjs',
      'migrate.config.mts',
    ]) {
      if (existsSync(join(process.cwd(), file))) {
        configFile = file
        break
      }
    }
  }

  const configPath = join(process.cwd(), configFile)

  if (!existsSync(configPath)) {
    throw new Error(`Configuration file "${configFile}" does not exist in the current directory.`)
  }

  const configTransformed = await transform(await readFile(configPath, 'utf8'), {
    loader: 'ts',
    format: 'cjs',
    target: 'es2024',
    platform: 'node',
    sourcemap: false,
    keepNames: true
  })

  if (configTransformed.warnings.length > 0) {
    console.warn('Warnings during configuration transformation:');
    for (const warning of configTransformed.warnings) {
      console.warn(warning.text);
    }
  }

  const transformedConfigPath = join(process.cwd(), 'migrate.config.js')
  await writeFile(transformedConfigPath, configTransformed.code, 'utf8')
  const { default: { default: config } } = await import(transformedConfigPath)

  await rm(transformedConfigPath, { force: true })

  if (!config || !config.strategy) {
    throw new Error(`Configuration file "${configFile}" must export a default object with a "strategy" property.`)
  }

  const mig = new Migrator(config)

  try {
    await mig.setup()
    await cb(mig)
  } finally {
    await mig.destroy()
  }
}

program
  .name('migrate')
  .description('A simple migration tool for managing migrations scripts')
  .option('-c, --config <path>', 'Path to the configuration file', '')
  .action(() => {
    program.help()
  })

program.command('init')
  .description('Initialize the migration configuration file')
  .action(async () => {
    const configFile = program.optsWithGlobals().config || 'migrate.config.ts'
    const configPath = join(process.cwd(), configFile)

    if (existsSync(configPath)) {
      console.error(`Configuration file "${configFile}" already exists.`)
      return
    }

    const configContent = `import { defineConfig } from '@salomaosnff/migrate'

export default defineConfig({
  strategy: null, // Replace with your migration strategy instance
  migrations_dir: 'migrations',
});

`

    try {
      await writeFile(configPath, configContent, 'utf8')
      console.log(`Configuration file "${configFile}" created successfully.`)
    } catch (error: any) {
      console.error(`Failed to create configuration file: ${error.message}`)
    }
  })

program
  .command('create <migrationName>')
  .description('Create a new migration file')
  .action(async (migrationName) => {
    const { config } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => mig.create(migrationName))
  })

program
  .command('up [migrationName]')
  .description('Apply migrations up to the specified migration name')
  .action(async (migrationName) => {
    const { config } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => mig.up(migrationName))
  })

program
  .command('down [migrationName]')
  .description('Revert migrations down to the specified migration name')
  .action(async (migrationName) => {
    const { config } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => mig.down(migrationName))
  })

program
  .command('latest')
  .description('Apply all pending migrations')
  .action(async () => {
    const { config } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => mig.latest())
  })

program
  .command('rollback')
  .description('Revert the latest batch of migrations')
  .action(async () => {
    const { config = 'migrate.config.ts' } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => mig.rollback())
  })

program
  .command('status')
  .description('Show the status of migrations')
  .action(async () => {
    const { config = 'migrate.config.ts' } = program.optsWithGlobals();
    await createMigrator(config, async (mig) => {
      const pendingMigrations = await mig.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        console.log('All migrations are up to date.');
      }
      else {
        console.log(`Pending migrations (${pendingMigrations.length}):`);
        for (const migration of pendingMigrations) {
          console.log(`- ${migration.name}`);
        }
      }
    })
  })

program.parse(process.argv)
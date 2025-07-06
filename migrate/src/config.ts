import { join } from "node:path"
import { MigrationStrategy } from "./core/strategy.js"

export interface Config {
  strategy: MigrationStrategy
  migrations_dir?: string
}

export function defineConfig(config: Config): Required<Config> {
  config.migrations_dir ??= 'migrations'

  config.migrations_dir = join(process.cwd(), config.migrations_dir)
  return config as Required<Config>
}
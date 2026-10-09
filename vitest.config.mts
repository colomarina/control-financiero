import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    fsModuleCache: true,
    coverage: {
      provider: 'v8',
      include: ['lib/core/**'],
      exclude: ['**/*.test.ts'],
      // Ojo: el reporter de texto NO lista los archivos con 100% en todas las
      // métricas. Si uno "desaparece" de la tabla es porque está entero, no
      // porque no se esté midiendo. Para ver todos: --coverage.reporter=json-summary
      reporter: ['text'],
    },
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, '.') },
  },
})

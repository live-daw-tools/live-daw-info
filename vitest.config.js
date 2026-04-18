import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			reporter: ['text', 'html'],
			exclude: ['tests/**', 'node_modules/**', 'vitest.config.*', 'scripts/**'],
			thresholds: {
				lines: 50,
				branches: 50,
				functions: 50,
				statements: 50,
			},
			reportOnFailure: true,
		},
	},
})

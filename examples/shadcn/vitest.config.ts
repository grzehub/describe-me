import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

// A shadcn/ui project on Tailwind 4, as `npx shadcn init` sets it up for Vite. The setup
// file imports src/index.css for every test file, as the app's entry would.
export default defineConfig({
  plugins: [react(), tailwindcss(), describeMe()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})

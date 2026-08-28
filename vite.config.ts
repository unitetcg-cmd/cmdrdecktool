import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project GitHub Pages URL is https://unitetcg-cmd.github.io/cmdrdecktool/
export default defineConfig({
  base: '/cmdrdecktool/',
  plugins: [react()],
  server: {
    proxy: {
      // Local `npm run dev` only. Production builds always call api.scryfall.com.
      '/scryfall': {
        target: 'https://api.scryfall.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scryfall/, ''),
      },
    },
  },
})

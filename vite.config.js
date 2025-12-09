import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['three']
  },
  build: {
    rollupOptions: {
      input: {
        login: 'index.html',
        register: 'register.html',
        home: 'home.html',
        game: 'game.html'
      }
    }
  }
})
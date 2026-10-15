import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entryPoints: [
        'resources/css/compiles/app.css',
        'resources/js/compiles/auth.js',
        'resources/js/realtime.js',
        'resources/js/compiles/animate.js',
        'resources/js/message.js',
        'resources/js/groupe.js',
        'resources/js/profile.js',
        'resources/js/settings.js',
        'resources/js/stories.js',
        'resources/js/users.js',
      ],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  server: {
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})

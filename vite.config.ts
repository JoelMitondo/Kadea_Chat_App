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
        'resources/jscompiles/auth.js',
        'resources/js/realtime.js',
        'resource/js/compiles/animate.js',
        'resource/js/groupe.js',
        'resource/js/message.js',
        'resource/js/profile.js',
        'resource/js/settings.js',
        'resource/js/stories.js',
        'resource/js/users.js',
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

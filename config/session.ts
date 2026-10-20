import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

const sessionConfig = defineConfig({
  enabled: true,
  cookieName: 'adonis-session',
  clearWithBrowser: false,
  age: '2h', // la durée de la session. après quoi, l'utilisateur sera déconnecter
  cookie: {
    path: '/',
    httpOnly: true,
    secure: app.inProduction, //le cookies sircule qu'en HTTPS
    sameSite: 'lax',
  },
  store: env.get('SESSION_DRIVER'),
  stores: {
    cookie: stores.cookie(),
    database: stores.database(),
  },
})

export default sessionConfig

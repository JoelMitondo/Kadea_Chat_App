// LIMITATION DU NOMBRE DE REQUÊTES (anti force brute, anti envoi massif d'e-mails)
// Les compteurs sont gardés en base (table rate_limits) : ils survivent à un redémarrage du serveur.
// En test, LIMITER_STORE=memory évite d'écrire dans la base.

import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE', 'database'),
  stores: {
    database: stores.database({
      tableName: 'rate_limits',
    }),
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}

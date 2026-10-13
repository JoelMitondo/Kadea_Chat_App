import logger from '@adonisjs/core/services/logger'
import { purgeExpiredStories } from '../app/service/story_service.ts'

// Le nettoyage s'exécute toutes les 10 minutes
const PURGE_EVERY_MS = 10 * 60 * 1000

async function runPurge() {
  try {
    const count = await purgeExpiredStories()
    if (count > 0) {
      logger.info(`${count} story(s) expirée(s) supprimée(s)`)
    }
  } catch (error) {
    // Une erreur de nettoyage ne doit jamais faire tomber le serveur
    logger.error({ err: error }, 'Échec du nettoyage des stories expirées')
  }
}

// Au démarrage : rattrape les stories expirées pendant que le serveur était arrêté
await runPurge()

// Puis toutes les 10 minutes. unref() : ce minuteur n'empêche pas le serveur de s'arrêter.
setInterval(runPurge, PURGE_EVERY_MS).unref()

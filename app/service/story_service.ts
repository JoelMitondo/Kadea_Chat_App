import { type DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Story from '#models/storie'
import { deleteImageByUrl } from './cloudinary_service.ts'

// Règles des stories : modifiez ces deux chiffres pour changer le comportement
export const MAX_ACTIVE_STORIES = 5
export const STORY_LIFETIME_HOURS = 24

/**
 * Temps restant avant l'expiration, en texte : "3 h 12 min", "45 min"...
 * (le JavaScript de la page utilise la même règle pour mettre à jour les textes)
 */
export function formatTimeLeft(expiresAt: DateTime): string {
  const minutes = Math.ceil(expiresAt.diffNow('minutes').minutes)

  if (minutes <= 0) {
    return 'expirée'
  }
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`
}

/**
 * Supprime les stories expirées : l'image sur Cloudinary PUIS la ligne en base.
 * Renvoie le nombre de stories supprimées.
 *
 * Même si ce nettoyage tardait, une story expirée n'est jamais affichée :
 * les pages ne chargent que les stories dont expires_at est dans le futur.
 */
export async function purgeExpiredStories(): Promise<number> {
  let total = 0

  // Par paquets de 100, jusqu'à ce qu'il n'y en ait plus
  while (true) {
    const expiredStories = await Story.query().where('expiresAt', '<=', new Date()).limit(100)

    if (expiredStories.length === 0) {
      break
    }

    for (const story of expiredStories) {
      const deleted = await deleteImageByUrl(story.imageUrl)
      if (!deleted) {
        // L'image n'a pas pu être supprimée (détail dans les logs) : on supprime quand même la
        // ligne, sinon on retenterait indéfiniment.
        logger.warn({ storyId: story.id }, 'Image de story non supprimée de Cloudinary')
      }
    }

    await Story.query()
      .whereIn(
        'id',
        expiredStories.map((story) => story.id)
      )
      .delete()

    total += expiredStories.length
  }

  return total
}

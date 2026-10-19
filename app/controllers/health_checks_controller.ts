/*Il s'agit là d'une fausse requete que le robot de UptimeRobot va envoyer chaque 13 min pour eviter
que mon serveur sur render gratuit s'endorme */

import type { HttpContext } from '@adonisjs/core/http'

export default class HealthChecksController {
  /**
   * Health check endpoint pour maintenir le serveur éveillé
   */
  public async ping({ response }: HttpContext) {
    return response.ok({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  }
}

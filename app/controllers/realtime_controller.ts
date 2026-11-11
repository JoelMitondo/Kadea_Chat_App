import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import UserConversation from '#models/user_conversation'
import { GROUP_TYPE } from '#services/chat_service'
import { marqueConversationCommeLueEtPrevient } from '#services/realtime_service'

export default class RealtimeController {
  /**
   * Nombre de messages non lus, pour les pastilles de la barre de navigation
   * Réponse : { private: 3, group: 1 }
   */
  async donneCompteursNonLus({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const rows = await db
      .from('message_statuses')
      .join('messages', 'messages.id', 'message_statuses.message_id')
      .join('conversations', 'conversations.id', 'messages.conversation_id')
      .join('conversation_types', 'conversation_types.id', 'conversations.conversation_type_id')
      .where('message_statuses.user_id', user.id)
      .where('message_statuses.is_read', false)
      .where('messages.is_deleted', false)
      .select('conversation_types.type')
      .count('* as total')
      .groupBy('conversation_types.type')

    const counts = { private: 0, group: 0 }
    for (const row of rows) {
      if (row.type === GROUP_TYPE) {
        counts.group = Number(row.total)
      } else {
        counts.private = Number(row.total)
      }
    }

    return response.ok(counts)
  }

  /**
   * Appelé par le navigateur quand un message arrive dans la conversation que l'utilisateur
   * est en train de regarder : il est lu immédiatement, l'expéditeur voit les coches bleues.
   */
  async marqueCommeLu({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    // Sécurité : l'utilisateur doit faire partie de cette conversation (sinon erreur 404)
    await UserConversation.query()
      .where('userId', user.id)
      .where('conversationId', conversationId)
      .firstOrFail()

    await marqueConversationCommeLueEtPrevient(user.id, conversationId)

    return response.noContent()
  }
}

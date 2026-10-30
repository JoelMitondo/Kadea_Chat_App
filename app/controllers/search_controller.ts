import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import UserConversation from '#models/user_conversation'
import { searchMessagesValidator } from '#validators/search'
import {
  GROUP_TYPE,
  protegeCaracteresRecherche,
  formateHeure,
  donneLibelleDuJour,
} from '../service/chat_service.ts'

// Nombre maximum de résultats affichés
const RESULTS_LIMIT = 50

export default class SearchController {
  async donnePageRecherche({ auth, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const { q } = await request.validateUsing(searchMessagesValidator)
    const search = q ?? ''

    // Pas de recherche (ou trop courte) : on affiche seulement le champ
    if (search.length < 2) {
      return view.render('pages/search', { search, results: [], hasSearched: false })
    }

    // Les messages qui contiennent le mot, dans MES conversations seulement :
    // le "join" sur user_conversations ne garde que les conversations où je suis participant.
    const rows = await db
      .from('messages')
      .join('user_conversations as me', 'me.conversation_id', 'messages.conversation_id')
      .join('conversations', 'conversations.id', 'messages.conversation_id')
      .join('conversation_types', 'conversation_types.id', 'conversations.conversation_type_id')
      .join('users as sender', 'sender.id', 'messages.user_id')
      .where('me.user_id', user.id)
      .where('messages.is_deleted', false)
      .whereILike('messages.content', `%${protegeCaracteresRecherche(search)}%`)
      .where((query) => {
        // Si j'ai supprimé la conversation, je ne cherche que dans les messages arrivés après
        query.whereNull('me.removed_at').orWhereRaw('messages.created_at > me.removed_at')
      })
      .orderBy('messages.created_at', 'desc')
      .limit(RESULTS_LIMIT)
      .select(
        'messages.id',
        'messages.content',
        'messages.created_at',
        'messages.conversation_id',
        'conversations.title',
        'conversation_types.type',
        'sender.full_name as sender_name'
      )

    // Pour une conversation PRIVÉE, le nom affiché est celui de l'autre personne
    const privateIds = rows
      .filter((row) => row.type !== GROUP_TYPE)
      .map((row) => row.conversation_id as number)

    const otherNames = new Map<number, string>()

    if (privateIds.length > 0) {
      const others = await UserConversation.query()
        .whereIn('conversationId', privateIds)
        .whereNot('userId', user.id)
        .preload('user')

      for (const other of others) {
        otherNames.set(other.conversationId, other.user.fullName)
      }
    }

    // On prépare les résultats pour la vue
    const results = rows.map((row) => {
      const isGroup = row.type === GROUP_TYPE
      const date = DateTime.fromJSDate(row.created_at)
      const parts = this.decoupeAutourDuMot(row.content as string, search)

      return {
        isGroup,
        conversationName: isGroup
          ? (row.title ?? 'Groupe sans nom')
          : (otherNames.get(row.conversation_id) ?? 'Conversation'),
        senderName: row.sender_name as string,
        when: `${donneLibelleDuJour(date)} · ${formateHeure(date)}`,
        // Un clic ouvre la conversation (ou le groupe) qui contient le message
        url: isGroup ? `/groups/${row.conversation_id}` : `/conversations/${row.conversation_id}`,
        before: parts.before,
        match: parts.match,
        after: parts.after,
      }
    })

    return view.render('pages/search', { search, results, hasSearched: true })
  }

  /**
   * Découpe le message en 3 morceaux autour du mot trouvé,
   * pour pouvoir surligner le mot : "...avant" + "MOT" + "après..."
   */
  private decoupeAutourDuMot(content: string, search: string) {
    const index = content.toLowerCase().indexOf(search.toLowerCase())

    // Par sécurité (ne devrait pas arriver) : on renvoie le début du message
    if (index === -1) {
      return { before: content.slice(0, 120), match: '', after: '' }
    }

    const start = Math.max(0, index - 40)
    const end = Math.min(content.length, index + search.length + 80)

    return {
      before: (start > 0 ? '…' : '') + content.slice(start, index),
      match: content.slice(index, index + search.length),
      after: content.slice(index + search.length, end) + (end < content.length ? '…' : ''),
    }
  }
}

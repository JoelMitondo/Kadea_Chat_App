import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import {
  buildMessageView,
  buildPreview,
  findPrivateMembership,
  getInitials,
  getListTime,
  markConversationAsRead,
} from '../service/chat_service.ts'

// Nombre maximum de messages chargés à l'ouverture d'une conversation
const MESSAGES_LIMIT = 100

export default class ConversationsController {
  /**
   * Page de messagerie, sans conversation ouverte
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await this.getConversationList(user)

    return view.render('pages/message', { conversations, chat: null })
  }

  /**
   * Ouvre une conversation.
   * - Appel depuis le JavaScript de la page : on renvoie seulement le panneau de discussion.
   * - Ouverture directe de l'adresse (rechargement, lien) : on renvoie la page complète.
   */
  async show({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const chat = await this.getChat(user, Number(params.id))

    if (request.header('x-requested-with') === 'XMLHttpRequest') {
      return view.render('partials/chat-panel', { chat })
    }

    // La liste est chargée APRÈS getChat() : les messages sont déjà passés en "lu"
    const conversations = await this.getConversationList(user, chat.id)
    return view.render('pages/message', { conversations, chat })
  }

  /**
   * Supprime la conversation DE LA LISTE de l'utilisateur (l'autre personne la garde).
   * On renseigne removed_at : les anciens messages ne sont plus affichés.
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const membership = await findPrivateMembership(user.id, conversationId).firstOrFail()
    membership.removedAt = DateTime.now()
    await membership.save()

    await markConversationAsRead(user.id, conversationId)

    return response.ok({ message: 'La conversation a été supprimée.' })
  }

  // ---------- Méthodes privées ----------

  /**
   * Liste des conversations privées de l'utilisateur, la plus récente en premier
   */
  private async getConversationList(user: User, openConversationId: number | null = null) {
    const memberships = await UserConversation.query()
      .where('userId', user.id)
      .whereHas('conversation', (conversationQuery) => {
        conversationQuery.whereHas('type', (typeQuery) => {
          typeQuery.where('type', 'Privee')
        })
      })
      .preload('lastMessage')
      .preload('conversation', (conversationQuery) => {
        conversationQuery.preload('users', (usersQuery) => {
          usersQuery.whereNot('users.id', user.id)
        })
      })

    const unreadCounts = await this.getUnreadCounts(
      user.id,
      memberships.map((membership) => membership.conversationId)
    )

    const items = []

    for (const membership of memberships) {
      const otherUser = membership.conversation.users[0]
      if (!otherUser) {
        continue
      }

      // Dernier message "visible" : on ignore ceux d'avant la suppression de la conversation
      let lastMessage: Message | null = membership.lastMessage
      if (lastMessage && membership.removedAt && lastMessage.createdAt <= membership.removedAt) {
        lastMessage = null
      }

      // Une conversation supprimée reste cachée... sauf si elle est ouverte en ce moment
      const isHidden = membership.removedAt !== null && lastMessage === null
      if (isHidden && membership.conversationId !== openConversationId) {
        continue
      }

      items.push({
        sortTime: (lastMessage?.createdAt ?? membership.conversation.createdAt).toMillis(),
        view: {
          id: membership.conversationId,
          name: otherUser.fullName,
          initials: getInitials(otherUser.fullName),
          avatarUrl: otherUser.avatarUrl,
          isOnline: otherUser.isOnline,
          preview: lastMessage ? buildPreview(lastMessage, user.id) : 'Aucun message',
          time: lastMessage ? getListTime(lastMessage.createdAt) : '',
          unreadCount: unreadCounts.get(membership.conversationId) ?? 0,
        },
      })
    }

    items.sort((a, b) => b.sortTime - a.sortTime)
    return items.map((item) => item.view)
  }

  /**
   * Nombre de messages non lus par conversation (table message_statuses)
   */
  private async getUnreadCounts(userId: User['id'], conversationIds: number[]) {
    const counts = new Map<number, number>()

    if (conversationIds.length === 0) {
      return counts
    }

    const rows = await db
      .from('message_statuses')
      .join('messages', 'messages.id', 'message_statuses.message_id')
      .where('message_statuses.user_id', userId)
      .where('message_statuses.is_read', false)
      .where('messages.is_deleted', false)
      .whereIn('messages.conversation_id', conversationIds)
      .select('messages.conversation_id')
      .count('* as total')
      .groupBy('messages.conversation_id')

    for (const row of rows) {
      counts.set(Number(row.conversation_id), Number(row.total))
    }

    return counts
  }

  /**
   * Prépare toutes les données d'une conversation ouverte
   */
  private async getChat(user: User, conversationId: number) {
    const membership = await findPrivateMembership(user.id, conversationId)
      .preload('conversation', (conversationQuery) => {
        conversationQuery.preload('users', (usersQuery) => {
          usersQuery.whereNot('users.id', user.id)
        })
      })
      .firstOrFail()

    const otherUser = membership.conversation.users[0]
    if (!otherUser) {
      throw new Error('Interlocuteur introuvable pour cette conversation.')
    }

    // Ouvrir la conversation = lire les messages reçus
    await markConversationAsRead(user.id, conversationId)

    // On charge les derniers messages (du plus récent au plus ancien), puis on remet dans l'ordre
    const messagesQuery = Message.query()
      .where('conversationId', conversationId)
      .preload('statuses', (statusQuery) => {
        statusQuery.where('userId', otherUser.id) // pour les coches "lu" de mes messages
      })
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(MESSAGES_LIMIT)

    // Après une suppression de la conversation, on ne montre que les messages plus récents
    if (membership.removedAt) {
      messagesQuery.where('createdAt', '>', membership.removedAt.toJSDate())
    }

    const messages = await messagesQuery
    messages.reverse()

    return {
      id: conversationId,
      other: {
        name: otherUser.fullName,
        initials: getInitials(otherUser.fullName),
        avatarUrl: otherUser.avatarUrl,
        isOnline: otherUser.isOnline,
      },
      messages: messages.map((message) => buildMessageView(message, user.id)),
    }
  }
}

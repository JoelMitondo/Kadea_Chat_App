import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import {
  //buildMessageView,
  buildPreview,
  //findPrivateMembership,
  getInitials,
  getListTime,
  //markConversationAsRead,
} from './../service/chat_service.ts'

export default class ConversationsController {
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await this.getConversationList(user)

    return view.render('pages/message', { conversations, chat: null })
  }

  private async getConversationList(user: User) {
    // on a afficher toutes les conversations privées aux quelles fait partie l'utilisateur tout en chargeant l'autre utilisateur
    const memberships = await UserConversation.query()
      .where('userId', user.id)
      .whereHas('conversation', (conversationQuery) => {
        conversationQuery.whereHas('type', (typeQuery) => {
          typeQuery.where('type', 'Privee')
        })
      })
      .preload('lastMessage')
      .preload('conversation', (conversationQuery) => {
        // On ne charge que l'AUTRE utilisateur de la conversation
        conversationQuery.preload('users', (usersQuery) => {
          usersQuery.whereNot('users.id', user.id)
        })
      })

    // gestion de la conversation en cas de suppression. lorsqu'il y aura un nouveau message, la conversation réaparait
    const visibleMemberships = memberships.filter((membership) => {
      if (!membership.removedAt) {
        return true
      }
      const lastMessage = membership.lastMessage
      return Boolean(lastMessage && lastMessage.createdAt > membership.removedAt)
    })

    const unreadCounts = await this.getUnreadCounts(
      user.id,
      visibleMemberships.map((membership) => membership.conversationId)
    )

    const items = []

    for (const membership of visibleMemberships) {
      const otherUser = membership.conversation.users[0]
      if (!otherUser) {
        continue
      }

      const lastMessage = membership.lastMessage

      items.push({
        // Sert uniquement à trier (activité la plus récente en premier)
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
    return items.map((item) => item.view) // on écarte l'objet sortime pour n'afficher que le view
  }

  // on compte les messages non lus pour chaque conversation et on retourne l'id de la conversation et les nombre de ses messages non lu
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
}

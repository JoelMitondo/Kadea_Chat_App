import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageStatus from '#models/message_status'
import MessageType from '#models/message_type'
import UserConversation from '#models/user_conversation'
import { sendMessageValidator, updateMessageValidator } from '#validators/message'
import {
  GROUP_TYPE,
  buildMessageView,
  buildPreview,
  findGroupMembership,
  findPrivateMembership,
  getListTime,
  needsDaySeparator,
} from '../service/chat_service.ts'
import {
  notifyMessageUpdated,
  notifyNewMessage,
  type ConversationKind,
} from '../service/realtime_service.ts'

export default class MessagesController {
  /**
   * Envoie un message dans une conversation PRIVÉE
   */
  async store(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await findPrivateMembership(user.id, Number(ctx.params.id)).firstOrFail()
    return this.sendMessage(ctx, membership, 'private')
  }

  /**
   * Envoie un message dans un GROUPE (tous les membres peuvent écrire)
   */
  async storeInGroup(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await findGroupMembership(user.id, Number(ctx.params.id))
      .preload('conversation') // pour connaître le nom du groupe
      .firstOrFail()
    return this.sendMessage(ctx, membership, 'group')
  }

  /**
   * Modifie un message (uniquement par son auteur)
   */
  async update({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const { content } = await request.validateUsing(updateMessageValidator)
    const message = await Message.findOrFail(params.id)

    if (message.userId !== user.id) {
      return response.forbidden({ message: 'Vous ne pouvez modifier que vos propres messages.' })
    }
    if (message.isDeleted) {
      return response.badRequest({ message: 'Ce message a été supprimé.' })
    }

    message.content = content
    await message.save()

    // On recharge les statuts des autres pour garder les bonnes coches
    await message.load('statuses', (statusQuery) => {
      statusQuery.whereNot('userId', user.id)
    })

    const data = await this.buildMessageResponse(message, user.id, view)

    // TEMPS RÉEL : les autres participants voient la modification tout de suite
    await this.notifyOthers(message, user, data.isLast)

    return response.ok(data)
  }

  /**
   * Supprime un message (uniquement par son auteur) : suppression "douce"
   */
  async destroy({ auth, params, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const message = await Message.findOrFail(params.id)

    if (message.userId !== user.id) {
      return response.forbidden({ message: 'Vous ne pouvez supprimer que vos propres messages.' })
    }

    message.merge({ isDeleted: true, deletedAt: DateTime.now() })
    await message.save()

    const data = await this.buildMessageResponse(message, user.id, view)

    // TEMPS RÉEL : le message devient "Ce message a été supprimé" chez les autres
    await this.notifyOthers(message, user, data.isLast)

    return response.ok(data)
  }

  // ---------- Méthodes privées ----------

  /**
   * Enregistre un nouveau message (conversation privée OU groupe)
   */
  private async sendMessage(
    ctx: HttpContext,
    membership: UserConversation,
    kind: ConversationKind
  ) {
    const { auth, request, response, view } = ctx
    const user = auth.getUserOrFail()
    const { content } = await request.validateUsing(sendMessageValidator)
    const conversationId = membership.conversationId

    // Tous les AUTRES participants (1 en privé, plusieurs dans un groupe)
    const otherMemberships = await UserConversation.query()
      .where('conversationId', conversationId)
      .whereNot('userId', user.id)

    const textType = await MessageType.findByOrFail('type', 'texte')

    // Dernier message existant : sert à décider du séparateur de date
    const previousMessage = await Message.query()
      .where('conversationId', conversationId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    // Transaction : soit TOUT est enregistré, soit RIEN
    const message = await db.transaction(async (trx) => {
      const newMessage = await Message.create(
        { userId: user.id, conversationId, messageTypeId: textType.id, content },
        { client: trx }
      )

      // Un statut "non lu" pour chaque destinataire (il alimente son compteur)
      await MessageStatus.createMany(
        otherMemberships.map((other) => ({
          messageId: newMessage.id,
          userId: other.userId,
          isRead: false,
          status: 'sent',
        })),
        { client: trx }
      )

      // Dernier message de la conversation, pour tous les participants
      await UserConversation.query({ client: trx })
        .where('conversationId', conversationId)
        .update({ last_message_id: newMessage.id })

      return newMessage
    })

    // Réponse à celui qui vient d'écrire (comme avant)
    const showSeparator = needsDaySeparator(previousMessage, message, membership)
    const data = await this.buildMessageResponse(message, user.id, view, showSeparator)

    // TEMPS RÉEL : les autres participants reçoivent le message tout de suite.
    // Le message est déjà enregistré : même si cet envoi échoue, rien n'est perdu.
    await message.load('user')
    await notifyNewMessage({
      message,
      sender: user,
      kind,
      conversationName: kind === 'group' ? (membership.conversation?.title ?? null) : null,
      previousMessage,
      recipients: otherMemberships,
    })

    return response.created(data)
  }

  /**
   * Prévient les autres participants qu'un message a été modifié ou supprimé
   */
  private async notifyOthers(message: Message, sender: User, isLast: boolean) {
    // Est-ce une conversation privée ou un groupe ?
    const conversation = await Conversation.query()
      .where('id', message.conversationId)
      .preload('type')
      .firstOrFail()
    const kind: ConversationKind = conversation.type.type === GROUP_TYPE ? 'group' : 'private'

    const recipients = await UserConversation.query()
      .where('conversationId', message.conversationId)
      .whereNot('userId', sender.id)

    await message.load('user') // pour le nom de l'auteur dans un groupe

    await notifyMessageUpdated({ message, kind, isLast, recipients })
  }

  /**
   * Réponse JSON commune : la bulle déjà fabriquée en HTML + de quoi mettre la liste à jour
   */
  private async buildMessageResponse(
    message: Message,
    userId: User['id'],
    view: HttpContext['view'],
    showSeparator = false
  ) {
    const lastMessage = await Message.query()
      .where('conversationId', message.conversationId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    const html = await view.render('partials/message-item', {
      message: buildMessageView(message, userId),
      showSeparator,
    })

    return {
      html,
      isLast: lastMessage?.id === message.id,
      preview: buildPreview(message, userId),
      time: getListTime(message.createdAt),
    }
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import MessageStatus from '#models/message_status'
import MessageType from '#models/message_type'
import UserConversation from '#models/user_conversation'
import { sendMessageValidator, updateMessageValidator } from '#validators/message'
import {
  buildMessageView,
  buildPreview,
  findGroupMembership,
  findPrivateMembership,
  getDayKey,
  getListTime,
} from '../service/chat_service.ts'

export default class MessagesController {
  /**
   * Envoie un message dans une conversation PRIVÉE
   */
  async store(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await findPrivateMembership(user.id, Number(ctx.params.id)).firstOrFail()
    return this.sendMessage(ctx, membership)
  }

  /**
   * Envoie un message dans un GROUPE (tous les membres peuvent écrire)
   */
  async storeInGroup(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await findGroupMembership(user.id, Number(ctx.params.id)).firstOrFail()
    return this.sendMessage(ctx, membership)
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
    return response.ok(data)
  }

  // ---------- Méthodes privées ----------

  /**
   * Enregistre un nouveau message (conversation privée OU groupe)
   */
  private async sendMessage(ctx: HttpContext, membership: UserConversation) {
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

    // Faut-il afficher un séparateur de date avant ce message ?
    let showSeparator = true
    if (
      previousMessage &&
      (!membership.removedAt || previousMessage.createdAt > membership.removedAt)
    ) {
      showSeparator = getDayKey(previousMessage.createdAt) !== getDayKey(message.createdAt)
    }

    const data = await this.buildMessageResponse(message, user.id, view, showSeparator)
    return response.created(data)
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

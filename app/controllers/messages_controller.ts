// MESSAGES : envoi, modification, suppression.
// Parcours d'un message : formulaire -> route -> ce contrôleur (validation, droits, base de données)
// -> réponse à l'expéditeur + événement temps réel vers les autres participants.

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import MessageStatus from '#models/message_status'
import MessageType from '#models/message_type'
import UserConversation from '#models/user_conversation'
import { IMAGE_EXTENSIONS, sendMessageValidator, updateMessageValidator } from '#validators/message'
import {
  GROUP_TYPE,
  construitVueMessage,
  construitApercu,
  chercheParticipationGroupe,
  chercheParticipationPrivee,
  donneHeureDeLaListe,
  besoinSeparateurDeJour,
} from '../service/chat_service.ts'
import { aBloque } from '../service/block_service.ts'
import { supprimeFichierParLien, envoieDocument, envoieImage } from '../service/cloudinary_service.ts'
import {
  previensMessageModifie,
  previensNouveauMessage,
  type ConversationKind,
} from '../service/realtime_service.ts'

export default class MessagesController {
  /**
   * Envoie un message dans une conversation PRIVÉE
   */
  async enregistreMessagePrive(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await chercheParticipationPrivee(user.id, Number(ctx.params.id)).firstOrFail()
    return this.envoieMessage(ctx, membership, 'private')
  }

  /**
   * Envoie un message dans un GROUPE (tous les membres peuvent écrire)
   */
  async enregistreMessageGroupe(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const membership = await chercheParticipationGroupe(user.id, Number(ctx.params.id))
      .preload('conversation') // pour connaître le nom du groupe
      .firstOrFail()
    return this.envoieMessage(ctx, membership, 'group')
  }

  /**
   * Modifie un message (uniquement par son auteur)
   */
  async modifieMessage({ auth, params, request, response, view }: HttpContext) {
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

    const data = await this.construitReponseMessage(message, user.id, view)

    // TEMPS RÉEL : les autres participants voient la modification tout de suite
    await this.previensAutresParticipants(message, user, data.isLast)

    return response.ok(data)
  }

  /**
   * Supprime un message (uniquement par son auteur) : suppression "douce"
   */
  async supprimeMessage({ auth, params, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const message = await Message.findOrFail(params.id)

    if (message.userId !== user.id) {
      return response.forbidden({ message: 'Vous ne pouvez supprimer que vos propres messages.' })
    }

    message.merge({ isDeleted: true, deletedAt: DateTime.now() })
    await message.save()

    // Si le message avait un fichier, on le supprime de Cloudinary puis de la base
    const attachments = await MessageAttachment.query().where('messageId', message.id)
    for (const file of attachments) {
      await supprimeFichierParLien(file.filePath)
    }
    await MessageAttachment.query().where('messageId', message.id).delete()
    const data = await this.construitReponseMessage(message, user.id, view)

    // TEMPS RÉEL : le message devient "Ce message a été supprimé" chez les autres
    await this.previensAutresParticipants(message, user, data.isLast)

    return response.ok(data)
  }

  // ---------- Méthodes privées ----------

  /**
   * Enregistre un nouveau message (conversation privée OU groupe)
   */
  /**
   * Enregistre un nouveau message (conversation privée OU groupe), avec ou sans fichier
   */
  private async envoieMessage(
    ctx: HttpContext,
    membership: UserConversation,
    kind: ConversationKind
  ) {
    const { auth, request, response, view, logger } = ctx
    const user = auth.getUserOrFail()
    const { content, attachment } = await request.validateUsing(sendMessageValidator)
    const conversationId = membership.conversationId

    // ÉTAPE 1 : il faut au moins un texte ou un fichier
    if (!content && !attachment) {
      return response.unprocessableEntity({
        errors: [{ field: 'content', message: 'Écrivez un message ou joignez un fichier.' }],
      })
    }

    // Tous les AUTRES participants (1 en privé, plusieurs dans un groupe)
    const otherMemberships = await UserConversation.query()
      .where('conversationId', conversationId)
      .whereNot('userId', user.id)

    // ÉTAPE 2 : BLOCAGE (conversations privées) :
    // si l'autre personne m'a bloqué, je ne peux plus lui écrire
    if (kind === 'private' && otherMemberships.length > 0) {
      const isBlocked = await aBloque(otherMemberships[0].userId, user.id)
      if (isBlocked) {
        return response.forbidden({ message: "Impossible d'envoyer ce message à cet utilisateur." })
      }
    }

    // ÉTAPE 3 : s'il y a un fichier, on l'envoie vers Cloudinary
    let messageTypeName = 'texte'
    let fileUrl: string | null = null
    const extension = (attachment?.extname ?? '').toLowerCase()

    if (attachment) {
      const isImage = IMAGE_EXTENSIONS.includes(extension)
      messageTypeName = isImage ? 'images' : 'document'

      try {
        fileUrl = isImage
          ? await envoieImage(attachment.tmpPath!, 'messages')
          : await envoieDocument(attachment.tmpPath!, 'messages', extension)
      } catch (error) {
        logger.error({ err: error }, "Échec de l'envoi du fichier vers Cloudinary")
        return response.unprocessableEntity({
          errors: [
            {
              field: 'attachment',
              message: "Impossible d'envoyer le fichier pour le moment. Réessayez dans un instant.",
            },
          ],
        })
      }
    }

    const messageType = await MessageType.firstOrCreate(
      { type: messageTypeName },
      { type: messageTypeName }
    )

    // Dernier message existant : sert à décider du séparateur de date
    const previousMessage = await Message.query()
      .where('conversationId', conversationId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    // ÉTAPE 4 : enregistrement en base. Transaction : soit TOUT est enregistré, soit RIEN.
    // Transaction : le message, son fichier, ses statuts et le "dernier message" sont enregistrés ensemble.
    let message: Message
    try {
      message = await db.transaction(async (trx) => {
        const newMessage = await Message.create(
          {
            userId: user.id,
            conversationId,
            messageTypeId: messageType.id,
            content: content ?? null,
          },
          { client: trx }
        )

        // Le fichier : on enregistre seulement son lien et ses informations
        if (attachment && fileUrl) {
          await MessageAttachment.create(
            {
              messageId: newMessage.id,
              fileName: (attachment.clientName ?? 'fichier').slice(0, 200),
              filePath: fileUrl,
              mimeType: `${attachment.type ?? 'application'}/${attachment.subtype ?? 'octet-stream'}`,
              fileSize: attachment.size,
            },
            { client: trx }
          )
        }

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
    } catch (error) {
      // La base a refusé : le fichier ne sert à rien, on le supprime de Cloudinary
      await supprimeFichierParLien(fileUrl)
      throw error
    }

    // On charge le fichier du message : il est nécessaire pour construire la bulle
    await message.load('attachments')

    // Réponse à celui qui vient d'écrire
    const showSeparator = besoinSeparateurDeJour(previousMessage, message, membership)
    const data = await this.construitReponseMessage(message, user.id, view, showSeparator)

    // TEMPS RÉEL : les autres participants reçoivent le message tout de suite
    await message.load('user')
    await previensNouveauMessage({
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
  private async previensAutresParticipants(message: Message, sender: User, isLast: boolean) {
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

    await previensMessageModifie({ message, kind, isLast, recipients })
  }

  /**
   * Réponse JSON commune : la bulle déjà fabriquée en HTML + de quoi mettre la liste à jour
   */
  private async construitReponseMessage(
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
      message: construitVueMessage(message, userId),
      showSeparator,
    })

    return {
      html,
      isLast: lastMessage?.id === message.id,
      preview: construitApercu(message, userId),
      time: donneHeureDeLaListe(message.createdAt),
    }
  }
}

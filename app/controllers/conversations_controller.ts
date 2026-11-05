import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import type User from '#models/user'
import type Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { olderMessagesValidator } from '#validators/message'
import {
  PRIVATE_TYPE,
  construitVueMessage,
  construitApercu,
  chargePageMessages,
  chercheParticipationPrivee,
  donneInitiales,
  donneHeureDeLaListe,
  marqueConversationCommeLue,
  memeJourQueLePremierAffiche,
  donneNombreMessagesNonLus,
} from '../service/chat_service.ts'
import { marqueConversationCommeLueEtPrevient } from './../service/realtime_service.ts'
import { aBloque } from '../service/block_service.ts'

export default class ConversationsController {
  /**
   * Page de messagerie, sans conversation ouverte
   */
  async donnePageMessages({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await this.donneListeConversations(user)

    return view.render('pages/message', { conversations, chat: null })
  }

  /**
   * Ouvre une conversation.
   * - Appel depuis le JavaScript de la page : on renvoie seulement le panneau de discussion.
   * - Ouverture directe de l'adresse (rechargement, lien) : on renvoie la page complète.
   */
  async donneConversation({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    // donneDiscussion verifie qu'une personne fait partie d'une discussion
    const chat = await this.donneDiscussion(user, Number(params.id))

    if (request.header('x-requested-with') === 'XMLHttpRequest') {
      return view.render('partials/chat-panel', { chat })
    }

    // La liste est chargée APRÈS donneDiscussion() : les messages sont déjà passés en "lu"
    const conversations = await this.donneListeConversations(user, chat.id)
    return view.render('pages/message', { conversations, chat })
  }

  /**
   * « Messages précédents » : la page de messages juste avant le plus ancien déjà affiché.
   * Réponse JSON : les bulles déjà fabriquées en HTML, à insérer en haut de la discussion.
   */
  async donneMessagesPrecedents({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)
    const { before } = await olderMessagesValidator.validate(request.qs())

    // Même contrôle d'accès qu'à l'ouverture : pas membre = 404
    const membership = await chercheParticipationPrivee(user.id, conversationId).firstOrFail()
    const otherMembership = await UserConversation.query()
      .where('conversationId', conversationId)
      .whereNot('userId', user.id)
      .firstOrFail()

    const page = await this.chargeMessages(
      conversationId,
      otherMembership.userId,
      membership.removedAt,
      before
    )

    return response.ok({
      html: await view.render('partials/messages-page', {
        messages: page.messages.map((message) => construitVueMessage(message, user.id)),
      }),
      hasMore: page.hasMore,
      oldestId: page.oldestId,
      dropFirstSeparator: await memeJourQueLePremierAffiche(page.messages, conversationId, before),
    })
  }

  /**
   * Supprime la conversation DE LA LISTE de l'utilisateur (l'autre personne la garde).
   * On renseigne removed_at : les anciens messages ne sont plus affichés.
   */
  async supprimeConversation({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const membership = await chercheParticipationPrivee(user.id, conversationId).firstOrFail()
    // Suppression "pour moi" : on ne supprime aucun message, car l'autre personne doit les garder.
    // On note seulement la date : je ne verrai plus que les messages arrivés après.
    membership.removedAt = DateTime.now()
    await membership.save()

    await marqueConversationCommeLue(user.id, conversationId)

    return response.ok({ message: 'La conversation a été supprimée.' })
  }

  // ---------- Méthodes privées ----------

  // Liste des conversations privées de l'utilisateur, la plus récente en premier

  private async donneListeConversations(user: User, openConversationId: number | null = null) {
    const memberships = await UserConversation.query()
      .where('userId', user.id)
      .whereHas('conversation', (conversationQuery) => {
        conversationQuery.whereHas('type', (typeQuery) => {
          typeQuery.where('type', PRIVATE_TYPE)
        })
      })
      .preload('lastMessage', (messageQuery) => {
        messageQuery.preload('attachments')
      })
      .preload('conversation', (conversationQuery) => {
        conversationQuery.preload('users', (usersQuery) => {
          usersQuery.whereNot('users.id', user.id)
        })
      })

    const unreadCounts = await donneNombreMessagesNonLus(
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
          userId: otherUser.id,
          name: otherUser.fullName,
          initials: donneInitiales(otherUser.fullName),
          avatarUrl: otherUser.avatarUrl,
          isOnline: otherUser.isOnline,
          preview: lastMessage ? construitApercu(lastMessage, user.id) : 'Aucun message',
          time: lastMessage ? donneHeureDeLaListe(lastMessage.createdAt) : '',
          unreadCount: unreadCounts.get(membership.conversationId) ?? 0,
        },
      })
    }

    items.sort((a, b) => b.sortTime - a.sortTime)
    return items.map((item) => item.view)
  }

  /**
   * Prépare toutes les données d'une conversation ouverte
   */
  private async donneDiscussion(user: User, conversationId: number) {
    const membership = await chercheParticipationPrivee(user.id, conversationId)
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

    await marqueConversationCommeLueEtPrevient(user.id, conversationId)

    // La page la plus récente ; les plus anciennes se chargent avec « Messages précédents »
    const page = await this.chargeMessages(conversationId, otherUser.id, membership.removedAt, null)

    return {
      id: conversationId,
      // Est-ce que j'ai bloqué cet interlocuteur ? (pour le bandeau et le bouton Débloquer)
      blockedByMe: await aBloque(user.id, otherUser.id),
      other: {
        id: otherUser.id,
        name: otherUser.fullName,
        initials: donneInitiales(otherUser.fullName),
        avatarUrl: otherUser.avatarUrl,
        isOnline: otherUser.isOnline,
      },
      messages: page.messages.map((message) => construitVueMessage(message, user.id)),
      hasMore: page.hasMore,
      oldestId: page.oldestId,
    }
  }

  /**
   * Une page de messages de la conversation privée.
   * removedAt : après une suppression de la conversation, on ne montre que les messages plus récents.
   */
  private chargeMessages(
    conversationId: number,
    otherUserId: User['id'],
    removedAt: DateTime | null,
    before: number | null
  ) {
    return chargePageMessages({
      conversationId,
      before,
      visibleAfter: removedAt,
      prepare: (query) => {
        query.preload('attachments').preload('statuses', (statusQuery) => {
          statusQuery.where('userId', otherUserId) // pour les coches de mes messages
        })
      },
    })
  }
}

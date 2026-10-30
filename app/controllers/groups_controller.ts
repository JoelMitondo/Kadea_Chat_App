// GROUPES : liste, ouverture, création, ajout de membres, suppression.
// Les actions sensibles vérifient d'abord le rôle : seul l'administrateur peut ajouter ou supprimer.

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { addMembersValidator, createGroupValidator } from '#validators/group'
import { ajouteMembresAuGroupe, creeGroupe } from '../service/group.ts'
import { supprimeConversationEtFichiers } from '../service/deletion_service.ts'
import {
  ADMIN_ROLE,
  GROUP_TYPE,
  construitVueMessage,
  construitApercu,
  chercheParticipationGroupe,
  formateDate,
  donneInitiales,
  donneHeureDeLaListe,
  donneNombreMessagesNonLus,
} from '../service/chat_service.ts'
import {
  previensConversationAjoutee,
  previensGroupeModifie,
  marqueConversationCommeLueEtPrevient,
  previensConversationSupprimee,
} from '../service/realtime_service.ts'

// Nombre maximum de messages chargés à l'ouverture d'un groupe
const MESSAGES_LIMIT = 100

export default class GroupsController {
  /**
   * Page Groupes, sans groupe ouvert
   */
  async donnePageGroupes({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const groups = await this.donneListeGroupes(user)
    const candidates = await this.donneCandidats([user.id]) // pour la popup de création

    return view.render('pages/groups', { groups, chat: null, candidates })
  }

  /**
   * Ouvre un groupe (même principe que les conversations privées :
   * panneau seul pour le JavaScript, page complète sinon)
   */
  async donneGroupe({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const chat = await this.donneDiscussion(user, Number(params.id))

    if (request.header('x-requested-with') === 'XMLHttpRequest') {
      return view.render('partials/group-panel', { chat })
    }

    const groups = await this.donneListeGroupes(user)
    const candidates = await this.donneCandidats([user.id])
    return view.render('pages/groups', { groups, chat, candidates })
  }

  /**
   * Crée un groupe
   */
  async enregistreGroupe({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { name, member_ids: memberIds } = await request.validateUsing(createGroupValidator)

    // Le créateur est déjà dans le groupe (administrateur) : on l'enlève de la liste s'il y figure
    const otherIds = memberIds.filter((id) => id !== user.id)

    if (otherIds.length < 2) {
      return response.unprocessableEntity({
        errors: [{ field: 'member_ids', message: 'Sélectionnez au moins deux autres membres.' }],
      })
    }

    // Tous les membres choisis doivent exister
    const existingUsers = await User.query().whereIn('id', otherIds).select('id')
    if (existingUsers.length !== otherIds.length) {
      return response.unprocessableEntity({
        errors: [{ field: 'member_ids', message: 'Un des membres sélectionnés est introuvable.' }],
      })
    }

    const group = await creeGroupe(user, name, otherIds)

    // TEMPS RÉEL : les membres voient le nouveau groupe apparaître dans leur liste
    await previensConversationAjoutee({ conversation: group, userIds: otherIds, lastMessage: null })

    // Le message s'affichera (toast) sur la page du groupe où le JavaScript redirige
    session.flash('success', `Le groupe « ${name} » a été créé.`)
    return response.created({ id: group.id })
  }

  /**
   * Ajoute des membres à un groupe (réservé à l'administrateur)
   */
  async ajouteMembres({ auth, params, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)
    const { member_ids: memberIds } = await request.validateUsing(addMembersValidator)

    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation') // pour le nom du groupe
      .firstOrFail()

    if (membership.role.title !== ADMIN_ROLE) {
      return response.forbidden({
        message: "Seul l'administrateur du groupe peut ajouter des membres.",
      })
    }

    const existingUsers = await User.query().whereIn('id', memberIds).select('id')
    if (existingUsers.length !== memberIds.length) {
      return response.unprocessableEntity({
        errors: [
          { field: 'member_ids', message: 'Un des utilisateurs sélectionnés est introuvable.' },
        ],
      })
    }

    // ajouteMembresAuGroupe renvoie maintenant la LISTE des identifiants réellement ajoutés
    const addedIds = await ajouteMembresAuGroupe(conversationId, memberIds)

    if (addedIds.length === 0) {
      return response.unprocessableEntity({
        errors: [{ field: 'member_ids', message: 'Ces utilisateurs font déjà partie du groupe.' }],
      })
    }

    // TEMPS RÉEL 1 : les nouveaux membres voient le groupe apparaître dans leur liste
    const lastMessage = await Message.query()
      .where('conversationId', conversationId)
      .preload('user')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    await previensConversationAjoutee({
      conversation: membership.conversation,
      userIds: addedIds,
      lastMessage,
    })

    // TEMPS RÉEL 2 : les membres déjà présents voient le groupe se mettre à jour
    const allMembers = await UserConversation.query()
      .where('conversationId', conversationId)
      .select('user_id')
    const existingMemberIds = allMembers
      .map((row) => row.userId)
      .filter((id) => id !== user.id && !addedIds.includes(id))
    previensGroupeModifie(conversationId, existingMemberIds)

    const message =
      addedIds.length === 1
        ? '1 membre a été ajouté.'
        : `${addedIds.length} membres ont été ajoutés.`
    session.flash('success', message)
    return response.ok({ message })
  }

  /**
   * Supprime un groupe, pour TOUS ses membres (réservé à l'administrateur)
   */
  async supprimeGroupe({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation')
      .firstOrFail()

    // Seul l'administrateur peut supprimer le groupe
    if (membership.role.title !== ADMIN_ROLE) {
      return response.forbidden({
        message: "Seul l'administrateur du groupe peut le supprimer.",
      })
    }

    const groupName = membership.conversation.title ?? 'Groupe sans nom'

    // Suppression du groupe, de ses messages et de ses fichiers
    const memberIds = await supprimeConversationEtFichiers(conversationId)

    // TEMPS RÉEL : les autres membres voient le groupe disparaître de leur liste
    previensConversationSupprimee({
      userIds: memberIds.filter((memberId) => memberId !== user.id),
      conversationId,
      kind: 'group',
      message: `Le groupe « ${groupName} » a été supprimé par son administrateur.`,
    })

    // Ce message s'affichera sur la page Groupes où le navigateur redirige
    session.flash('success', `Le groupe « ${groupName} » a été supprimé.`)
    return response.ok({ message: 'Groupe supprimé.' })
  }
  // ---------- Méthodes privées ----------

  /**
   * Liste des groupes de l'utilisateur, le plus récent en premier
   */
  private async donneListeGroupes(user: User) {
    const memberships = await UserConversation.query()
      .where('userId', user.id)
      .whereHas('conversation', (conversationQuery) => {
        conversationQuery.whereHas('type', (typeQuery) => {
          typeQuery.where('type', GROUP_TYPE)
        })
      })
      .preload('conversation')
      .preload('lastMessage', (messageQuery) => {
        messageQuery.preload('user') // pour afficher "Jo : le projet est rendu"
        messageQuery.preload('attachments') // pour afficher "Image" s'il n'y a que un fichier
      })

    const unreadCounts = await donneNombreMessagesNonLus(
      user.id,
      memberships.map((membership) => membership.conversationId)
    )

    const items = memberships.map((membership) => {
      const lastMessage = membership.lastMessage
      const name = membership.conversation.title ?? 'Groupe sans nom'

      return {
        sortTime: (lastMessage?.createdAt ?? membership.conversation.createdAt).toMillis(),
        view: {
          id: membership.conversationId,
          name,
          initials: donneInitiales(name),
          preview: lastMessage ? construitApercu(lastMessage, user.id, true) : 'Aucun message',
          time: lastMessage ? donneHeureDeLaListe(lastMessage.createdAt) : '',
          unreadCount: unreadCounts.get(membership.conversationId) ?? 0,
        },
      }
    })

    items.sort((a, b) => b.sortTime - a.sortTime)
    return items.map((item) => item.view)
  }

  /**
   * Utilisateurs qu'on peut ajouter (tous, sauf ceux de la liste d'exclusion)
   */
  private async donneCandidats(excludedIds: User['id'][]) {
    const users = await User.query().whereNotIn('id', excludedIds).orderBy('fullName', 'asc')

    return users.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      initials: donneInitiales(person.fullName),
      avatarUrl: person.avatarUrl,
      isOnline: person.isOnline,
    }))
  }

  /**
   * Prépare toutes les données d'un groupe ouvert
   */
  private async donneDiscussion(user: User, conversationId: number) {
    // Seuls les membres du groupe peuvent l'ouvrir (sinon : erreur 404)
    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation', (conversationQuery) => {
        conversationQuery.preload('creator')
      })
      .firstOrFail()

    const conversation = membership.conversation
    const groupName = conversation.title ?? 'Groupe sans nom'
    const isAdmin = membership.role.title === ADMIN_ROLE

    // Tous les membres, administrateur(s) en premier
    const memberRows = await UserConversation.query()
      .where('conversationId', conversationId)
      .preload('user')
      .preload('role')

    const members = memberRows
      .map((row) => ({
        id: row.user.id,
        fullName: row.user.fullName,
        initials: donneInitiales(row.user.fullName),
        avatarUrl: row.user.avatarUrl,
        isOnline: row.user.isOnline,
        isAdmin: row.role.title === ADMIN_ROLE,
        isMe: row.userId === user.id,
      }))
      .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.fullName.localeCompare(b.fullName))

    // Ouvrir le groupe = lire ses messages
    await marqueConversationCommeLueEtPrevient(user.id, conversationId)

    const queriedMessages = await Message.query()
      .where('conversationId', conversationId)
      .preload('attachments')
      .preload('user') // pour le nom de l'auteur
      .preload('statuses', (statusQuery) => {
        statusQuery.whereNot('userId', user.id) // pour les coches "lu" de MES messages
      })
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(MESSAGES_LIMIT)
    const messages = queriedMessages.reverse()

    // Seul l'administrateur peut ajouter des membres : lui seul a besoin de la liste
    const candidates = isAdmin ? await this.donneCandidats(members.map((member) => member.id)) : []

    return {
      id: conversationId,
      group: {
        name: groupName,
        initials: donneInitiales(groupName),
        createdAt: formateDate(conversation.createdAt),
        creatorName: conversation.creator?.fullName ?? 'Utilisateur supprimé',
        membersCount: members.length,
        isAdmin,
      },
      members,
      candidates,
      messages: messages.map((message) => construitVueMessage(message, user.id, true)),
    }
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserConversation from '#models/user_conversation'
import GroupPolicy from '#policies/group_policy'
import {
  addMembersValidator,
  createGroupValidator,
  searchCandidatesValidator,
} from '#validators/group'
import { ajouteMembresAuGroupe, creeGroupe, retireMembreDuGroupe } from '#services/group'
import { chatWithUserValidator } from '#validators/user_list'
import { olderMessagesValidator } from '#validators/message'
import { supprimeConversationEtFichiers } from '#services/deletion_service'
import {
  ADMIN_ROLE,
  GROUP_TYPE,
  construitVueMessage,
  construitApercu,
  chargePageMessages,
  chercheParticipationGroupe,
  donneDernierMessage,
  memeJourQueLePremierAffiche,
  formateDate,
  donneInitiales,
  donneHeureDeLaListe,
  donneNombreMessagesNonLus,
  protegeCaracteresRecherche,
} from '#services/chat_service'
import {
  previensConversationAjoutee,
  previensGroupeModifie,
  marqueConversationCommeLueEtPrevient,
  previensConversationSupprimee,
} from '#services/realtime_service'

// Nombre maximum de personnes proposées dans la liste « ajouter des membres »
const CANDIDATES_LIMIT = 20

export default class GroupsController {
  // Page Groupes, sans groupe ouvert

  async donnePageGroupes({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const groups = await this.donneListeGroupes(user)
    const candidates = await this.donneCandidats([user.id]) // pour la popup de création

    return view.render('pages/groups', { groups, chat: null, candidates })
  }

  // Ouvre un groupe (même principe que les conversations privées :
  // panneau seul pour le JavaScript, page complète sinon)

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

  // « Messages précédents » d'un groupe (même principe que pour une conversation privée)

  async donneMessagesPrecedents({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)
    const { before } = await olderMessagesValidator.validate(request.qs())

    // Seuls les membres du groupe peuvent lire ses messages (sinon : erreur 404)
    await chercheParticipationGroupe(user.id, conversationId).firstOrFail()

    const page = await this.chargeMessages(conversationId, user.id, before)

    return response.ok({
      html: await view.render('partials/messages-page', {
        messages: page.messages.map((message) => construitVueMessage(message, user.id, true)),
      }),
      hasMore: page.hasMore,
      oldestId: page.oldestId,
      dropFirstSeparator: await memeJourQueLePremierAffiche(page.messages, conversationId, before),
    })
  }

  /**
   * Recherche de personnes à ajouter (création d'un groupe ou ajout de membres).
   * On ne charge jamais TOUS les utilisateurs : au plus CANDIDATES_LIMIT, filtrés par le nom tapé.
   * Réponse : les lignes de la liste déjà fabriquées en HTML (groupe.js les insère).
   */
  async donneCandidatsRecherche({ auth, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const { q, group } = await searchCandidatesValidator.validate(request.qs())

    let excludedIds: User['id'][] = [user.id]

    // Ajout à un groupe existant : on exclut ses membres (il faut en faire partie, sinon 404)
    if (group !== undefined) {
      await chercheParticipationGroupe(user.id, group).firstOrFail()
      const members = await UserConversation.query()
        .where('conversationId', group)
        .select('user_id')
      excludedIds = members.map((member) => member.userId)
    }

    const candidates = await this.donneCandidats(excludedIds, q)
    return view.render('partials/member-items', { candidates })
  }

  // Crée un groupe

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

  // Ajoute des membres à un groupe (réservé à l'administrateur)

  async ajouteMembres({ auth, bouncer, params, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)
    const { member_ids: memberIds } = await request.validateUsing(addMembersValidator)

    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation') // pour le nom du groupe
      .firstOrFail()

    // Réservé à l'administrateur (règle dans app/policies/group_policy.ts, sinon 403)
    await bouncer.with(GroupPolicy).authorize('ajouterMembres', membership)

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
    const lastMessage = await donneDernierMessage(conversationId, { withAuthor: true })

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

  // Retire un membre du groupe (réservé à l'administrateur).
  // Le membre retiré ne peut plus lire ni écrire dans le groupe : sa participation est supprimée.

  async retireMembre({ auth, bouncer, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)
    const { id: memberId } = await chatWithUserValidator.validate({ id: params.userId })

    // 1. Je dois être membre du groupe (sinon 404)...
    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation')
      .firstOrFail()

    // 2. ... et administrateur (sinon 403). La règle est vérifiée côté serveur, par la policy :
    // masquer le bouton dans la page ne suffit pas.
    await bouncer.with(GroupPolicy).authorize('retirerMembres', membership)

    // 3. L'administrateur ne se retire pas lui-même (le groupe n'aurait plus d'administrateur)
    if (memberId === user.id) {
      return response.unprocessableEntity({
        message: 'Vous ne pouvez pas vous retirer vous-même : supprimez plutôt le groupe.',
      })
    }

    // 4. La personne doit faire partie du groupe, et ne pas être administrateur
    const target = await UserConversation.query()
      .where('conversationId', conversationId)
      .where('userId', memberId)
      .preload('user')
      .preload('role')
      .first()

    if (!target) {
      return response.notFound({ message: 'Cette personne ne fait pas partie du groupe.' })
    }
    await bouncer.with(GroupPolicy).authorize('retirerCeMembre', target)

    await retireMembreDuGroupe(conversationId, memberId)

    const groupName = membership.conversation.title ?? 'Groupe sans nom'

    // TEMPS RÉEL 1 : le groupe disparaît immédiatement de la liste du membre retiré
    previensConversationSupprimee({
      userIds: [memberId],
      conversationId,
      kind: 'group',
      message: `Vous avez été retiré du groupe « ${groupName} ».`,
    })

    // TEMPS RÉEL 2 : les autres membres voient la liste des membres se mettre à jour
    const remaining = await UserConversation.query()
      .where('conversationId', conversationId)
      .whereNot('userId', user.id)
      .select('user_id')
    previensGroupeModifie(
      conversationId,
      remaining.map((row) => row.userId)
    )

    const message = `${target.user.fullName} a été retiré(e) du groupe.`
    session.flash('success', message)
    return response.ok({ message })
  }

  // Supprime un groupe, pour TOUS ses membres (réservé à l'administrateur)

  async supprimeGroupe({ auth, bouncer, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const membership = await chercheParticipationGroupe(user.id, conversationId)
      .preload('role')
      .preload('conversation')
      .firstOrFail()

    // Seul l'administrateur peut supprimer le groupe
    await bouncer.with(GroupPolicy).authorize('supprimer', membership)

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

  // Liste des groupes de l'utilisateur, le plus récent en premier

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
   * Utilisateurs qu'on peut ajouter (sauf ceux de la liste d'exclusion), filtrés par nom,
   * limités à CANDIDATES_LIMIT : la page reste légère même avec des milliers d'inscrits.
   */
  private async donneCandidats(excludedIds: User['id'][], search?: string) {
    const query = User.query()
      .whereNotIn('id', excludedIds)
      .orderBy('fullName', 'asc')
      .limit(CANDIDATES_LIMIT)
    if (search) {
      query.whereILike('fullName', `%${protegeCaracteresRecherche(search)}%`)
    }
    const users = await query

    return users.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      initials: donneInitiales(person.fullName),
      avatarUrl: person.avatarUrl,
      isOnline: person.isOnline,
    }))
  }

  // Prépare toutes les données d'un groupe ouvert

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

    // La page la plus récente ; les plus anciennes se chargent avec « Messages précédents »
    const page = await this.chargeMessages(conversationId, user.id, null)

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
      messages: page.messages.map((message) => construitVueMessage(message, user.id, true)),
      hasMore: page.hasMore,
      oldestId: page.oldestId,
    }
  }

  // Une page de messages du groupe

  private chargeMessages(conversationId: number, userId: User['id'], before: number | null) {
    return chargePageMessages({
      conversationId,
      before,
      visibleAfter: null,
      prepare: (query) => {
        query
          .preload('attachments')
          .preload('user') // pour le nom de l'auteur
          .preload('statuses', (statusQuery) => {
            statusQuery.whereNot('userId', userId) // pour les coches de MES messages
          })
      },
    })
  }
}

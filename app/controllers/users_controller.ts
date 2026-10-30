import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { searchUsersValidator, chatWithUserValidator } from '#validators/user_list'
import { chercheOuCreeConversationPrivee } from '../service/conversation_service.ts'
import { protegeCaracteresRecherche, formateDate, donneInitiales } from '../service/chat_service.ts'

const USERS_PER_PAGE = 20

export default class UsersController {
  /**
   * Liste des utilisateurs (avec recherche et pagination)
   * - Appel du JavaScript (recherche en direct) : on renvoie seulement la liste.
   * - Ouverture normale de la page : on renvoie la page complète.
   */
  async donnePageUtilisateurs({ auth, request, view }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const { q, page } = await request.validateUsing(searchUsersValidator)
    const search = q ?? ''

    // Tous les utilisateurs SAUF moi, par ordre alphabétique
    const query = User.query().whereNot('id', currentUser.id).orderBy('fullName', 'asc')

    if (search !== '') {
      query.whereILike('fullName', `%${protegeCaracteresRecherche(search)}%`)
    }

    // paginate découpe les résultats en pages : on ne charge que 20 utilisateurs à la fois.
    const paginator = await query.paginate(page ?? 1, USERS_PER_PAGE)

    const users = paginator.all().map((person) => ({
      id: person.id,
      fullName: person.fullName,
      initials: donneInitiales(person.fullName),
      avatarUrl: person.avatarUrl,
      email: person.email,
      isOnline: person.isOnline,
      createdAt: formateDate(person.createdAt),
    }))

    // Adresse d'une page, en gardant la recherche en cours
    const buildUrl = (pageNumber: number) =>
      `/users?q=${encodeURIComponent(search)}&page=${pageNumber}`

    const data = {
      users,
      search,
      pagination: {
        currentPage: paginator.currentPage,
        lastPage: paginator.lastPage,
        previousUrl: paginator.currentPage > 1 ? buildUrl(paginator.currentPage - 1) : null,
        nextUrl:
          paginator.currentPage < paginator.lastPage ? buildUrl(paginator.currentPage + 1) : null,
      },
    }

    if (request.header('x-requested-with') === 'XMLHttpRequest') {
      return view.render('partials/users-list', data)
    }
    return view.render('pages/users', data)
  }

  /**
   * Bouton "Discuter" : ouvre la conversation privée existante, ou la crée, puis redirige
   */
  async ouvreDiscussion({ auth, params, response, session }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const { id } = await chatWithUserValidator.validate({ id: params.id })

    if (id === currentUser.id) {
      session.flash('error', 'Vous ne pouvez pas discuter avec vous-même.')
      return response.redirect().toRoute('users')
    }

    const otherUser = await User.findOrFail(id)
    const conversation = await chercheOuCreeConversationPrivee(currentUser, otherUser)

    // La page Messages s'ouvre directement sur cette conversation, avec ses messages
    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}

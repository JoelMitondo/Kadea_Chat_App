import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { chatWithUserValidator } from '#validators/user_list'
import { bloqueUtilisateur, debloqueUtilisateur } from '#services/block_service'

export default class BlocksController {
  /**
   * Bloquer un utilisateur
   */
  async bloque({ auth, params, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { id } = await chatWithUserValidator.validate({ id: params.id })

    if (id === me.id) {
      return response.unprocessableEntity({ message: 'Vous ne pouvez pas vous bloquer vous-même.' })
    }

    await User.findOrFail(id) // erreur 404 si cet utilisateur n'existe pas
    await bloqueUtilisateur(me.id, id)

    // Appel du JavaScript : on répond en JSON. Formulaire normal : on revient à la page.
    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message: 'Utilisateur bloqué.' })
    }
    session.flash('success', 'Utilisateur bloqué.')
    return response.redirect().back()
  }

  /**
   * Débloquer un utilisateur
   */
  async debloque({ auth, params, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { id } = await chatWithUserValidator.validate({ id: params.id })

    await debloqueUtilisateur(me.id, id)

    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message: 'Utilisateur débloqué.' })
    }
    session.flash('success', 'Utilisateur débloqué.')
    return response.redirect().back()
  }
}

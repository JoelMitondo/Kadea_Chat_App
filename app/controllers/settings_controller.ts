import type { HttpContext } from '@adonisjs/core/http'
import BlockedUser from '#models/blocked_user'
import { donneInitiales } from '../service/chat_service.ts'
import User from '#models/user'
import { deleteAccountValidator } from '#validators/account'
import { supprimeCompteUtilisateur } from '../service/deletion_service.ts'

export default class SettingsController {
  /**
   * Page Paramètres : mot de passe + liste des utilisateurs bloqués
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    // Les personnes que j'ai bloquées, avec leurs informations
    const blockedRows = await BlockedUser.query()
      .where('blockerId', user.id)
      .preload('blocked')
      .orderBy('id', 'desc')

    const blockedUsers = blockedRows.map((row) => ({
      id: row.blocked.id,
      fullName: row.blocked.fullName,
      initials: donneInitiales(row.blocked.fullName),
      avatarUrl: row.blocked.avatarUrl,
    }))

    return view.render('pages/settings', { blockedUsers })
  }

  /**
   * L'utilisateur a confirmé qu'il a toujours accès à son e-mail :
   * on le déconnecte et on l'envoie sur la page "Mot de passe oublié",
   * qui fait tout le reste (envoi du lien par e-mail, nouveau mot de passe).
   */
  async startPasswordChange({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()

    session.flash(
      'success',
      'Vous avez été déconnecté. Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.'
    )

    return response.redirect().toRoute('forgotPassword.get')
  }

  /**
   * Supprime définitivement le compte de l'utilisateur connecté
   */
  async deleteAccount({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { password } = await request.validateUsing(deleteAccountValidator)

    // ÉTAPE 1 : on vérifie que c'est bien lui, avec son mot de passe
    try {
      await User.verifyCredentials(user.email, password)
    } catch {
      return response.unprocessableEntity({
        errors: [{ field: 'password', message: 'Mot de passe incorrect.' }],
      })
    }

    // ÉTAPE 2 : suppression du compte et de ses données
    await supprimeCompteUtilisateur(user)

    // ÉTAPE 3 : déconnexion (le compte n'existe plus)
    await auth.use('web').logout()

    return response.ok({ message: 'Votre compte a été supprimé définitivement.' })
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import BlockedUser from '#models/blocked_user'
import { getInitials } from '../service/chat_service.ts'

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
      initials: getInitials(row.blocked.fullName),
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
}

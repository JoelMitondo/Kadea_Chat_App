import type { HttpContext } from '@adonisjs/core/http'
import BlockedUser from '#models/blocked_user'
import { donneInitiales } from '#services/chat_service'
import User from '#models/user'
import { changePasswordValidator, deleteAccountValidator } from '#validators/account'
import hash from '@adonisjs/core/services/hash'
import { supprimeCompteUtilisateur } from '#services/deletion_service'

export default class SettingsController {
  /**
   * Page Paramètres : changement du mot de passe, utilisateurs bloqués, suppression du compte
   */
  async donnePageParametres({ auth, view }: HttpContext) {
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
   * Change le mot de passe de l'utilisateur connecté.
   * 1. le validateur vérifie la forme (8 caractères minimum, confirmation identique, différent de l'ancien) ;
   * 2. on vérifie que le mot de passe ACTUEL est le bon (quelqu'un qui trouverait la session
   *    ouverte ne doit pas pouvoir le changer) ;
   * 3. on enregistre : withAuthFinder hache automatiquement le nouveau mot de passe.
   */
  async modifieMotDePasse({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { current_password: currentPassword, password } =
      await request.validateUsing(changePasswordValidator)

    const isValid = await hash.verify(user.password, currentPassword)
    if (!isValid) {
      return response.unprocessableEntity({
        errors: [{ field: 'current_password', message: 'Mot de passe actuel incorrect.' }],
      })
    }

    user.password = password
    await user.save()

    const message = 'Votre mot de passe a été modifié.'
    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message })
    }
    session.flash('success', message)
    return response.redirect().toRoute('settings')
  }

  /**
   * Mot de passe actuel oublié : on déconnecte l'utilisateur et on l'envoie sur
   * « Mot de passe oublié » (lien de réinitialisation reçu par e-mail).
   * L'utilisateur a confirmé qu'il a toujours accès à son e-mail :
   * on le déconnecte et on l'envoie sur la page "Mot de passe oublié",
   * qui fait tout le reste (envoi du lien par e-mail, nouveau mot de passe).
   */
  async demarreChangementMotDePasse({ auth, response, session }: HttpContext) {
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
  async supprimeCompte({ auth, request, response }: HttpContext) {
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

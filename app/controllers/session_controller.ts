import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController handles user authentication and session management.
 * It provides methods for displaying the login page, authenticating users,
 * and logging out.
 */
export default class SessionController {
  /**
   * Display the login page
   */
  async donnePageConnexion({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Authenticate user credentials and create a new session
   */
  async connecte({ request, auth, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    // verifyCredentials cherche l'e-mail et compare le mot de passe à son hash.
    // En cas d'échec, il déclenche E_INVALID_CREDENTIALS, traduit dans app/exceptions/handler.ts.
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)
    response.redirect().toRoute('profile')
  }

  /**
   * Log out the current user and destroy their session
   */
  async deconnecte({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}

import User from '#models/user'
import Inscription from '#models/inscription'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
export default class NewAccountController {
  /**
   * Display the signup page
   */
  async create({ view, params, response }: HttpContext) {
    const inscription = await Inscription.findBy('codeAleatoire', params.code)

    if (!inscription) {
      return response.notFound("Lien d'inscription invalide ou expiré.")
    }
    return view.render('pages/auth/signup', {
      code: params.code,
      user: {
        full_name: inscription.fullName,
        birth_date: inscription.birthDate,
        email: inscription.email,
      },
    })
  }

  /**
   * Create a new user account and authenticate the user
   */
  async store({ request, response, auth, params }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)

    const inscription = await Inscription.findByOrFail('codeAleatoire', params.code)

    const userData = {
      fullName: inscription.fullName,
      birthDate: inscription.birthDate,
      email: inscription.email,
      emailVerifiedAt: DateTime.now(),
      password: payload.password,
      phoneNumber: payload.phone_number,
      avatarUrl: payload.avatar_url,
      bio: payload.bio,
    }
    const user = await User.create(userData)

    await inscription.delete()

    await auth.use('web').login(user)
    response.redirect().toRoute('dashboard')
  }
}

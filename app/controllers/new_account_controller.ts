import User from '#models/user'
import Inscription from '#models/inscription'
import { confirmationCompteValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
export default class NewAccountController {
  //function pour envoyer les information d'une invitation lors de l'enregistrement de l'utilisateur
  async create({ view, params, response }: HttpContext) {
    const inscription = await Inscription.find(params.id)

    if (!inscription) {
      return response.notFound("Lien d'inscription invalide ou expiré.")
    }

    // Lien expiré : inutile d'afficher le formulaire, l'envoi serait refusé
    if (DateTime.now() > inscription.expiredAt!) {
      await inscription.delete()
      return response.badRequest("Le lien d'inscription a expiré. Veuillez vous réinscrire.")
    }

    // On vérifie si le code fourni correspond au hash stocké en BDD
    const isValid = await hash.verify(inscription.codeAleatoire, params.code)

    if (!isValid) {
      return response.notFound("Lien d'inscription invalide ou expiré.")
    }
    return view.render('pages/auth/signup', {
      code: params.code,
      id: params.id,
      user: {
        full_name: inscription.fullName,
        birth_date: inscription.birthDate,
        email: inscription.email,
      },
    })
  }

  async store({ request, response, auth, params }: HttpContext) {
    const payload = await request.validateUsing(confirmationCompteValidator)

    const inscription = await Inscription.find(params.id)

    if (!inscription) {
      return response.notFound("Lien d'inscription invalide ou expiré.")
    }
    // Vérification de la date d'expiration
    if (DateTime.now() > inscription.expiredAt!) {
      // On nettoie la bdd
      await inscription.delete()
      return response.badRequest("Le lien d'inscription a expiré. Veuillez vous réinscrire.")
    }
    const isValid = await hash.verify(inscription.codeAleatoire, params.code)

    if (!isValid) {
      return response.notFound("Lien d'inscription invalide ou expiré.")
    }

    // Un compte a pu être créé avec cet e-mail entre-temps (autre lien d'inscription) :
    // sans cette vérification, la contrainte d'unicité provoquerait une erreur 500
    const existingUser = await User.findBy('email', inscription.email)
    if (existingUser) {
      await inscription.delete()
      return response.badRequest('Un compte existe déjà avec cette adresse e-mail. Connectez-vous.')
    }

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
    response.redirect().toRoute('messages')
  }
}

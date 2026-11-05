// CRÉATION DU COMPTE, deuxième étape de l'inscription.
// Le lien reçu par e-mail prouve que l'adresse existe. Le vrai compte (table users) n'est créé qu'ici :
// c'est pourquoi on ne peut pas se connecter tant que l'e-mail n'est pas confirmé.

import User from '#models/user'
import Inscription from '#models/inscription'
import { confirmationCompteValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { ERROR_PAGES, affichePageErreur } from '#services/error_page'

export default class NewAccountController {
  //function pour envoyer les information d'une invitation lors de l'enregistrement de l'utilisateur
  async donnePageCreationCompte(ctx: HttpContext) {
    const { view, params } = ctx
    const result = await this.chercheInscription(params.id, params.code)

    // Lien invalide ou expiré : page d'erreur du site qui explique quoi faire
    if (result.error) {
      return affichePageErreur(ctx, ERROR_PAGES[result.error])
    }

    const inscription = result.inscription
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

  async enregistreCompte(ctx: HttpContext) {
    const { request, response, auth, params } = ctx
    const payload = await request.validateUsing(confirmationCompteValidator)

    const result = await this.chercheInscription(params.id, params.code)
    if (result.error) {
      return affichePageErreur(ctx, ERROR_PAGES[result.error])
    }
    const inscription = result.inscription

    // Un compte a pu être créé avec cet e-mail entre-temps (autre lien d'inscription) :
    // sans cette vérification, la contrainte d'unicité provoquerait une erreur 500
    const existingUser = await User.findBy('email', inscription.email)
    if (existingUser) {
      await inscription.delete()
      return affichePageErreur(ctx, ERROR_PAGES.accountAlreadyExists)
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

  /**
   * Retrouve la demande d'inscription du lien reçu par e-mail.
   * Renvoie soit l'inscription, soit le type d'erreur à afficher.
   */
  private async chercheInscription(
    id: string,
    code: string
  ): Promise<
    | { error: null; inscription: Inscription }
    | { error: 'signupLinkInvalid' | 'signupLinkExpired'; inscription: null }
  > {
    // Identifiant non numérique : sans ce contrôle, PostgreSQL renverrait une erreur 500
    const inscriptionId = Number(id)
    if (!Number.isInteger(inscriptionId) || inscriptionId <= 0) {
      return { error: 'signupLinkInvalid', inscription: null }
    }

    const inscription = await Inscription.find(inscriptionId)
    if (!inscription) {
      return { error: 'signupLinkInvalid', inscription: null }
    }

    // On vérifie si le code fourni correspond au hash stocké en BDD
    const isValid = await hash.verify(inscription.codeAleatoire, code)
    if (!isValid) {
      return { error: 'signupLinkInvalid', inscription: null }
    }

    // Lien expiré : on nettoie la bdd
    if (DateTime.now() > inscription.expiredAt!) {
      await inscription.delete()
      return { error: 'signupLinkExpired', inscription: null }
    }

    return { error: null, inscription }
  }
}

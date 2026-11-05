// MOT DE PASSE OUBLIÉ, en 3 étapes :
//   1. l'utilisateur donne son e-mail : on enregistre un code haché valable 1 heure et on envoie un lien ;
//   2. il clique sur le lien : on vérifie le code et on affiche le formulaire ;
//   3. il envoie son nouveau mot de passe : on revérifie le code, on enregistre, puis on supprime la demande
//      pour que le lien ne serve qu'une seule fois.

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import ForgoPassword from '#models/forgo_password'
import { forgoPassewordValidator, newPassewordValidator } from '#validators/forgo_password'
import { genereCodeUnique } from '#services/code_generation'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { publicUrl } from '#config/app'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import { APP_TIMEZONE } from '#services/chat_service'
import ReinitialisationMotDePasseMail from '#mails/reinitialisation_mot_de_passe_mail'

export default class ForgoPasswordsController {
  async donnePageMotDePasseOublie({ view }: HttpContext) {
    return view.render('pages/auth/forgoPassword')
  }
  async enregistreDemandeReinitialisation({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgoPassewordValidator)

    const user = await User.findBy('email', email)

    if (user) {
      const codeAleatoire = await genereCodeUnique(ForgoPassword)
      const expiration = DateTime.now().plus({ hours: 1 })
      const identite = await ForgoPassword.updateOrCreate(
        { email: user.email },
        {
          userId: user.id,
          codeAleatoire: await hash.make(codeAleatoire),
          expiredAt: expiration,
        }
      )
      // Contenu de l'e-mail : resources/views/emails/reinitialisation_mot_de_passe.edge
      try {
        const resetLink = `${publicUrl}/forgoPassword/${identite.id}/${codeAleatoire}`
        const expiresAt = expiration.setZone(APP_TIMEZONE).toFormat("dd/MM/yyyy 'à' HH:mm")

        await mail.send(
          new ReinitialisationMotDePasseMail(
            { email: identite.email, fullName: user.fullName },
            resetLink,
            expiresAt
          )
        )
      } catch (error) {
        logger.error({ err: error }, "Erreur lors de l'envoi de l'e-mail de réinitialisation")
        if (request.accepts(['html', 'json']) === 'json') {
          return response.internalServerError({
            message: "Échec de l'envoi de l'e-mail de réinitialisation",
          })
        }
        session.flash('error', "Échec de l'envoi de l'e-mail de réinitialisation")
        return response.redirect().back()
      }
    }

    // Même réponse si le compte existe ou non : on ne révèle pas quels e-mails sont inscrits
    const message =
      'Si cette adresse correspond à un compte, un e-mail de réinitialisation vient de vous être envoyé.'
    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message })
    }
    session.flash('success', message)
    return response.redirect().toRoute('home')
  }

  async donnePageNouveauMotDePasse({ params, view }: HttpContext) {
    const recuperation = await this.chercheDemandeValide(params.id, params.code)

    // Lien invalide ou expiré : la page affiche le message "Lien invalide ou expiré"
    return view.render('pages/auth/updatePassword', {
      id: params.id,
      code: params.code,
      lienValide: recuperation !== null,
    })
  }

  async enregistreNouveauMotDePasse({ request, response, auth, params }: HttpContext) {
    const payload = await request.validateUsing(newPassewordValidator)

    const recuperation = await this.chercheDemandeValide(params.id, params.code)

    if (!recuperation) {
      return response.badRequest({ message: 'Lien de récupération invalide ou expiré.' })
    }

    //Récupération de l'utilisateur et mise à jour du mot de passe
    const user = await User.findOrFail(recuperation.userId)
    user.password = payload.password
    await user.save()

    //Nettoyage du jeton utilisé
    await recuperation.delete()

    await auth.use('web').login(user)

    // Formulaire envoyé par le script : il redirige lui-même (data-redirect)
    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message: 'Votre mot de passe a été modifié.' })
    }
    return response.redirect().toRoute('messages')
  }

  /**
   * Renvoie la demande de réinitialisation si le lien est valide (bon code, pas expiré), sinon null.
   * Une demande expirée est supprimée au passage.
   */
  private async chercheDemandeValide(id: string, code: string) {
    // Identifiant non numérique : sans ce contrôle, PostgreSQL renverrait une erreur 500
    const requestId = Number(id)
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return null
    }

    const recuperation = await ForgoPassword.find(requestId)
    if (!recuperation) {
      return null
    }

    if (recuperation.expiredAt! < DateTime.now()) {
      await recuperation.delete()
      return null
    }

    const isValid = await hash.verify(recuperation.codeAleatoire, code)
    return isValid ? recuperation : null
  }
}

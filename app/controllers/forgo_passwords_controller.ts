// MOT DE PASSE OUBLIÉ, en 3 étapes :
//   1. l'utilisateur donne son e-mail : on enregistre un code haché valable 1 heure et on envoie un lien ;
//   2. il clique sur le lien : on vérifie le code et on affiche le formulaire ;
//   3. il envoie son nouveau mot de passe : on revérifie le code, on enregistre, puis on supprime la demande
//      pour que le lien ne serve qu'une seule fois.

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import ForgoPassword from '#models/forgo_password'
import { forgoPassewordValidator, newPassewordValidator } from '#validators/forgo_password'
import { genereCodeUnique } from './../service/code_generation.ts'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { publicUrl } from '#config/app'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import { APP_TIMEZONE } from '../service/chat_service.ts'

export default class ForgoPasswordsController {
  async donnePageMotDePasseOublie({ view }: HttpContext) {
    return view.render('pages/auth/forgoPassword')
  }
  async enregistreDemandeReinitialisation({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgoPassewordValidator)

    const user = await User.findBy('email', email)

    if (user) {
      const codeAleatoire = await genereCodeUnique(ForgoPassword)
      const identite = await ForgoPassword.updateOrCreate(
        { email: user.email },
        {
          userId: user.id,
          codeAleatoire: await hash.make(codeAleatoire),
          expiredAt: DateTime.now().plus({ hours: 1 }),
        }
      )
      try {
        const baseUrl = publicUrl

        const resetLink = `${baseUrl}/forgoPassword/${identite.id}/${codeAleatoire}`

        const dateExpirationFormattee =
          typeof identite.expiredAt?.toFormat === 'function'
            ? identite.expiredAt.setZone(APP_TIMEZONE).toFormat("dd/MM/yyyy 'à' HH:mm")
            : identite.expiredAt

        // Envoi de l'email via Brevo
        await mail.send((message) => {
          message
            .to(identite.email)
            .from('mitondomohindo@gmail.com', 'Kadea Chat')
            .subject('Réinitialisation de votre mot de passe - Kadea Chat').html(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8; margin-bottom: 20px;">Réinitialisation de mot de passe</h2>
          
          <p>Bonjour <strong>${user.fullName}</strong>,</p>
          
          <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>Kadea Chat</strong>.</p>
          
          <p>Cliquez sur le bouton ci-dessous pour choisir votre nouveau mot de passe :</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #1a73e8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
              Réinitialiser mon mot de passe
            </a>
          </p>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-size: 0.95em;">
              <strong> Sécurité importante :</strong><br>
              Ne partagez jamais ce lien ni aucun code avec qui que ce soit. L'équipe <strong>Kadea Chat</strong> ne vous demandera jamais ces informations. Si une personne vous les demande, il s'agit d'une tentative de piratage.
            </p>
          </div>

          <p style="color: #7f8c8d; font-size: 0.9em;">
            Ce lien est à usage unique et expirera le <strong>${dateExpirationFormattee}</strong> (dans 1 heure).
          </p>

          <p style="color: #7f8c8d; font-size: 0.85em; margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px;">
            Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe actuel restera inchangé.
          </p>

          <br>
          <p style="margin: 0;">Cordialement,<br><strong>L'équipe Kadea Chat</strong></p>
        </div>
      `)
        })
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

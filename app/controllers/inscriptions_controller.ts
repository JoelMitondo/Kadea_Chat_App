// INSCRIPTION, première étape : on garde les informations dans la table inscriptions (temporaire)
// et on envoie le lien de confirmation. La suite est dans new_account_controller.ts.

import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import { inscriptionValidator } from '#validators/inscription'
import Inscription from '#models/inscription'
import { DateTime } from 'luxon'
import { genereCodeUnique } from './../service/code_generation.ts'
import hash from '@adonisjs/core/services/hash'
import { publicUrl } from '#config/app'
import { APP_TIMEZONE } from '../service/chat_service.ts'
import ConfirmationEmailMail from '#mails/confirmation_email_mail'

export default class InscriptionsController {
  async donnePageInscription({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }
  async enregistreInscription({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(inscriptionValidator)

    // Vérification de la majorité (avant tout le reste : inutile de générer un code pour rien)
    // Format { errors: [{ field, message }] } : le formulaire affiche l'erreur sous le bon champ
    if (!this.estMajeur(payload.birth_date)) {
      return response.unprocessableEntity({
        errors: [
          { field: 'birth_date', message: 'Vous devez avoir au moins 18 ans pour vous inscrire' },
        ],
      })
    }

    const fullName = `${payload.first_name} ${payload.last_name}`
    const inscriptionExpire = DateTime.now().plus({ days: 2 })
    const codeAleatoire = await genereCodeUnique(Inscription)

    // L'e-mail est unique dans la table inscriptions : si une demande est déjà en attente
    // pour cette adresse, on la remplace (nouveau lien) au lieu de provoquer une erreur 500.
    const identite = await Inscription.updateOrCreate(
      { email: payload.email },
      {
        codeAleatoire: await hash.make(codeAleatoire),
        fullName: fullName,
        birthDate: payload.birth_date,
        expiredAt: inscriptionExpire,
      }
    )

    // On envoie l'e-mail de confirmation (contenu : resources/views/emails/confirmation_email.edge)
    try {
      const activationLink = `${publicUrl}/signup/${identite.id}/${codeAleatoire}`
      const expiresAt = inscriptionExpire.setZone(APP_TIMEZONE).toFormat("dd/MM/yyyy 'à' HH:mm")

      await mail.send(
        new ConfirmationEmailMail({ email: payload.email, fullName }, activationLink, expiresAt)
      )

      // Envoi par le script : on répond en JSON (le message est celui de data-success)
      if (request.accepts(['html', 'json']) === 'json') {
        return response.created({ message: 'Compte créé.' })
      }
      // Envoi classique (sans JavaScript) : redirection avec un message
      session.flash('success', 'Votre compte a été créé. Vérifiez votre e-mail.')
      return response.redirect().toRoute('home')
    } catch (error) {
      logger.error({ err: error }, "Erreur lors de l'envoi de l'e-mail de confirmation")
      return response.status(500).json({
        success: false,
        message: "Échec de l'envoi de l'e-mail",
      })
    }
  }

  private estMajeur(dateNaissance: DateTime): boolean {
    // Récupère la date et l'heure actuelles du serveur backend
    const now = DateTime.now()

    // Calcule la date limite exacte : la date d'aujourd'hui moins 18 ans
    const dateLimites18Ans = now.minus({ years: 18 })

    // L'utilisateur est majeur si sa date de naissance est inférieure ou égale à la date limite
    return dateNaissance <= dateLimites18Ans
  }
}

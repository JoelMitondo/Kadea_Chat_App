import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import { inscriptionValidator } from '#validators/inscription'
import Inscription from '#models/inscription'
import { DateTime } from 'luxon'
import { generateUniqueCode } from './../service/code_generation.ts'
import hash from '@adonisjs/core/services/hash'

export default class InscriptionsController {
  async show({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }
  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(inscriptionValidator)

    const fullName = `${payload.first_name} ${payload.last_name}`
    const inscriptionExpire = this.calculateExpirationDate()
    const codeAleatoire = await generateUniqueCode(Inscription)

    // 3. Vérification de la majorité
    if (!this.isMajeur(payload.birth_date)) {
      return response.badRequest({
        error: 'Vous devez avoir au moins 18 ans pour vous inscrire',
      })
    }
    const identite = await Inscription.create({
      codeAleatoire: await hash.make(codeAleatoire),
      fullName: fullName,
      birthDate: payload.birth_date,
      email: payload.email,
      expiredAt: inscriptionExpire,
    })

    //on envoie maintenant un email de confirmation de email
    try {
      const baseUrl = `${request.protocol()}://${request.host()}`

      const activationLink = `${baseUrl}/signup/${identite.id}/${identite.codeAleatoire}`

      // Formatage de la date d'expiration si c'est un objet Luxon DateTime ou Date
      const dateExpirationFormattee =
        typeof inscriptionExpire?.toFormat === 'function'
          ? inscriptionExpire.toFormat('dd/MM/yyyy à HH:mm')
          : inscriptionExpire

      // Envoyer l'email via Brevo
      await mail.send((message) => {
        message
          .to(payload.email) // Adresse dynamique depuis payload.email
          .from('mitondomohindo@gmail.com', 'Kadea Chat')
          .subject('Confirmation de votre adresse email - Kadea Chat').html(`
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2>Bonjour ${fullName},</h2>
          
          <p>Merci de vous être inscrit sur <strong>Kadea Chat</strong> ! Pour finaliser la création de votre compte, veuillez confirmer votre adresse email.</p>
          
          <p>Voici un récapitulatif de vos informations :</p>
          <ul>
            <li><strong>Nom complet :</strong> ${fullName}</li>
            <li><strong>Adresse e-mail :</strong> ${payload.email}</li>
            <li><strong>Date d'expiration du lien :</strong> ${dateExpirationFormattee}</li>
          </ul>

          <p>Cliquez sur le bouton ci-dessous pour confirmer votre email. Vous serez ensuite redirigé vers une page vous permettant de compléter les informations de votre profil :</p>
          
          <p style="text-align: center; margin: 25px 0;">
            <a href="${activationLink}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Confirmer mon email
            </a>
          </p>

          <p style="color: #c0392b; font-size: 0.9em;">
            <strong>Attention :</strong> Ce lien d'activation expire dans <strong>48 heures</strong>. Passé ce délai, vous devrez refaire une demande de création de compte.
          </p>

          <br>
          <p>Cordialement,<br><strong>L'équipe Kadea Chat</strong></p>
        </div>
      `)
      })

      // Envoi par le script : on répond en JSON (le message est celui de data-success)
      if (request.accepts(['html', 'json']) === 'json') {
        return response.created({ message: 'Compte créé.' })
      }
      // Envoi classique (sans JavaScript) : redirection avec un message
      session.flash('success', 'Votre compte a été créé. Vérifiez votre e-mail.')
      return response.redirect().toRoute('home')
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'e-mail :", error)
      return response.status(500).json({
        success: false,
        message: "Échec de l'envoi de l'e-mail",
      })
    }
  }
  // Calcule la date d'expiration (Date actuelle + 2 jours)
  private calculateExpirationDate(): DateTime {
    // Récupère la date et l'heure actuelles du serveur backend
    const now = DateTime.now()

    // la date d'expiration après 48H
    const expirationDate = now.plus({ days: 2 })

    return expirationDate
  }

  private isMajeur(dateNaissance: DateTime): boolean {
    // Récupère la date et l'heure actuelles du serveur backend
    const now = DateTime.now()

    // Calcule la date limite exacte : la date d'aujourd'hui moins 18 ans
    const dateLimites18Ans = now.minus({ years: 18 })

    // L'utilisateur est majeur si sa date de naissance est inférieure ou égale à la date limite
    return dateNaissance <= dateLimites18Ans
  }
}

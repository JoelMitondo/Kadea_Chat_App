import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import ForgoPassword from '#models/forgo_password'
import { forgoPassewordValidator, newPassewordValidator } from '#validators/forgo_password'
import { generateUniqueCode } from './../service/code_generation.ts'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'

export default class ForgoPasswordsController {
  async index({ view }: HttpContext) {
    return view.render('pages/auth/forgoPassword')
  }
  async storeForgoPassword({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgoPassewordValidator)

    const user = await User.findBy('email', email)

    const codeAleatoire = await generateUniqueCode(ForgoPassword)

    if (user) {
      const identite = await ForgoPassword.create({
        userId: user.id,
        email: user.email,
        codeAleatoire: await hash.make(codeAleatoire),
        expiredAt: DateTime.now().plus({ hours: 1 }),
      })

      try {
        const baseUrl = `${request.protocol()}://${request.host()}`

        const resetLink = `${baseUrl}/forgoPassword/${identite.id}/${codeAleatoire}`

        const dateExpirationFormattee =
          typeof identite.expiredAt?.toFormat === 'function'
            ? identite.expiredAt.toFormat('dd/MM/yyyy à HH:mm')
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

        if (request.accepts(['html', 'json']) === 'json') {
          return response.ok({ message: 'E-mail de réinitialisation envoyé avec succès.' })
        }

        session.flash(
          'success',
          'Un e-mail de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.'
        )
        return response.redirect().toRoute('home')
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail :", error)
        return response.status(500).json({
          success: false,
          message: "Échec de l'envoi de l'e-mail de réinitialisation",
        })
      }
    }

    // Même réponse si le compte existe ou non
    return response.ok({ message: 'E-mail envoyé si le compte existe.' })
  }

  async indexPageNewPassword({ params, response, view }: HttpContext) {
    const inscription = await ForgoPassword.find(params.id)

    if (!inscription) {
      return response.notFound('Lien de récupération invalide ou expiré.')
    }

    const isValid = await hash.verify(inscription.codeAleatoire, params.code)

    if (!isValid) {
      return response.notFound('Lien de récupération invalide ou expiré.')
    }
    return view.render('pages/auth/updatePassword', {
      code: params.id,
      hash: params.code,
    })
  }

  async storeNewPassword({ request, response, auth, params }: HttpContext) {
    // 1. Validation du nouveau mot de passe
    const payload = await request.validateUsing(newPassewordValidator)

    // 2. Recherche de l'enregistrement de récupération
    const recuperation = await ForgoPassword.find(params.id)

    if (!recuperation) {
      return response.notFound('Lien de récupération invalide ou expiré.')
    }

    // 3. Vérification de la validité du lien/code
    const isValid = await hash.verify(recuperation.codeAleatoire, params.code)

    if (!isValid) {
      return response.notFound('Lien de récupération invalide ou expiré.')
    }

    // 4. Vérification de l'expiration du lien (optionnel mais conseillé)
    if (recuperation.expiredAt! < DateTime.now()) {
      await recuperation.delete()
      return response.badRequest('Le lien de récupération a expiré.')
    }

    // 5. Récupération de l'utilisateur et mise à jour du mot de passe
    const user = await User.findOrFail(recuperation.userId)
    user.password = payload.password
    await user.save()

    // 6. Nettoyage du jeton utilisé
    await recuperation.delete()

    // 7. Connexion automatique et redirection
    await auth.use('web').login(user)

    return response.redirect().toRoute('dashboard')
  }
}

// E-MAIL : lien de réinitialisation du mot de passe (« mot de passe oublié »).
// Le contenu est dans resources/views/emails/reinitialisation_mot_de_passe.edge.

import { BaseMail } from '@adonisjs/mail'

export default class ReinitialisationMotDePasseMail extends BaseMail {
  subject = 'Réinitialisation de votre mot de passe - Kadea Chat'

  constructor(
    private recipient: { email: string; fullName: string },
    private resetLink: string,
    private expiresAt: string
  ) {
    super()
  }

  prepare() {
    this.message.to(this.recipient.email).htmlView('emails/reinitialisation_mot_de_passe', {
      fullName: this.recipient.fullName,
      resetLink: this.resetLink,
      expiresAt: this.expiresAt,
    })
  }
}

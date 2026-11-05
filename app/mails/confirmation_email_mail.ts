// E-MAIL : confirmation de l'adresse e-mail après l'inscription.
// Le contenu est dans resources/views/emails/confirmation_email.edge (la vue, comme pour une page).
// L'expéditeur vient de la configuration (MAIL_FROM_ADDRESS, MAIL_FROM_NAME dans config/mail.ts).

import { BaseMail } from '@adonisjs/mail'

export default class ConfirmationEmailMail extends BaseMail {
  subject = 'Confirmation de votre adresse e-mail - Kadea Chat'

  constructor(
    private recipient: { email: string; fullName: string },
    private activationLink: string,
    private expiresAt: string
  ) {
    super()
  }

  prepare() {
    this.message.to(this.recipient.email).htmlView('emails/confirmation_email', {
      fullName: this.recipient.fullName,
      email: this.recipient.email,
      activationLink: this.activationLink,
      expiresAt: this.expiresAt,
    })
  }
}

// SÉCURITÉ ET ROBUSTESSE : identifiants invalides, limite d'essais, e-mails, redirection
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { publicUrl } from '#config/app'
import ReinitialisationMotDePasseMail from '#mails/reinitialisation_mot_de_passe_mail'
import { creeUtilisateur, TEST_PASSWORD } from '../helpers.ts'

test.group('Sécurité : adresses, connexion et e-mails', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un identifiant non numérique donne une 404, pas une erreur 500', async ({ client }) => {
    const alice = await creeUtilisateur('Alice Test')

    const conversation = await client.get('/conversations/abc').loginAs(alice)
    conversation.assertStatus(404)

    const message = await client
      .delete('/messages/abc')
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(alice)
    message.assertStatus(404)
  })

  test('après la connexion, on arrive sur la messagerie', async ({ client }) => {
    const alice = await creeUtilisateur('Alice Test')

    const response = await client
      .post('/login')
      .form({ email: alice.email, password: TEST_PASSWORD })
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/messages')
  })

  test('au-delà de 5 essais de connexion par minute, la requête est refusée (429)', async ({
    client,
  }) => {
    const alice = await creeUtilisateur('Alice Test')

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await client
        .post('/login')
        .header('Accept', 'application/json')
        .form({ email: alice.email, password: 'mauvais-mot-de-passe' })
        .withCsrfToken()
      response.assertStatus(400)
    }

    // Même avec le BON mot de passe : la limite s'applique avant toute vérification
    const blocked = await client
      .post('/login')
      .header('Accept', 'application/json')
      .form({ email: alice.email, password: TEST_PASSWORD })
      .withCsrfToken()
    blocked.assertStatus(429)
  })

  test("l'e-mail de réinitialisation part de APP_URL et échappe le nom", async ({ client }) => {
    const { mails } = mail.fake()
    const user = await creeUtilisateur('<b>Pirate</b> Test')

    const response = await client
      .post('/forgoPassword')
      .header('Accept', 'application/json')
      .form({ email: user.email })
      .withCsrfToken()

    response.assertStatus(200)
    mails.assertSent(ReinitialisationMotDePasseMail, (sent) => sent.message.hasTo(user.email))

    const [sent] = mails.sent()
    await sent.buildWithContents()
    sent.message.assertHtmlIncludes(`${publicUrl}/forgoPassword/`)
    sent.message.assertHtmlIncludes('&lt;b&gt;Pirate&lt;/b&gt;')

    mail.restore()
  })
})

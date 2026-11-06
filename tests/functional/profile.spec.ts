// PROFIL ET FINALISATION DU COMPTE : affichage des champs vides et des dates
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import Inscription from '#models/inscription'
import { creeUtilisateur } from '../helpers.ts'

test.group('Profil : champs facultatifs vides', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un champ vide ne s’affiche pas comme le texte « null »', async ({ client, assert }) => {
    const user = await creeUtilisateur('Alice Test') // sans téléphone ni biographie

    const page = await client.get('/profile').loginAs(user)

    page.assertStatus(200)
    assert.notInclude(page.text(), 'value="null"')
    assert.notInclude(page.text(), '>null</textarea>')
  })

  test('le profil s’enregistre sans numéro de téléphone', async ({ client, assert }) => {
    const user = await creeUtilisateur('Alice Test')

    const response = await client
      .post('/profile')
      .header('Accept', 'application/json')
      .form({
        full_name: 'Alice Test',
        bio: 'Étudiante à Kadea Academy',
        phone_number: '',
        birth_date: '2000-03-15',
      })
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.bio, 'Étudiante à Kadea Academy')
    assert.isNull(user.phoneNumber)
  })
})

test.group('Inscription : page de finalisation du compte', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('la date de naissance est affichée au format jj/mm/aaaa', async ({ client, assert }) => {
    const code = 'code-de-test-123'
    const inscription = await Inscription.create({
      email: 'eric@example.com',
      fullName: 'Éric Test',
      birthDate: DateTime.fromISO('1998-04-12'),
      codeAleatoire: await hash.make(code),
      expiredAt: DateTime.now().plus({ days: 2 }),
    })

    const page = await client.get(`/signup/${inscription.id}/${code}`)

    page.assertStatus(200)
    assert.include(page.text(), '12/04/1998')
    assert.notInclude(page.text(), '1998-04-12T')
  })
})

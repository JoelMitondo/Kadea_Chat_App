// CHANGEMENT DU MOT DE PASSE depuis les paramètres
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import { creeUtilisateur, TEST_PASSWORD } from '../helpers.ts'

test.group('Paramètres : changement du mot de passe', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un mot de passe actuel incorrect est refusé (422)', async ({ client, assert }) => {
    const user = await creeUtilisateur('Alice Test')

    const response = await client
      .post('/settings/password')
      .header('Accept', 'application/json')
      .json({
        current_password: 'mauvais-mot-de-passe',
        password: 'NouveauMotDePasse1',
        password_confirmation: 'NouveauMotDePasse1',
      })
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(422)
    await user.refresh()
    assert.isTrue(await hash.verify(user.password, TEST_PASSWORD))
  })

  test('une confirmation différente est refusée (422)', async ({ client }) => {
    const user = await creeUtilisateur('Alice Test')

    const response = await client
      .post('/settings/password')
      .header('Accept', 'application/json')
      .json({
        current_password: TEST_PASSWORD,
        password: 'NouveauMotDePasse1',
        password_confirmation: 'AutreChose123',
      })
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(422)
  })

  test('le mot de passe est changé et stocké haché', async ({ client, assert }) => {
    const user = await creeUtilisateur('Alice Test')

    const response = await client
      .post('/settings/password')
      .header('Accept', 'application/json')
      .json({
        current_password: TEST_PASSWORD,
        password: 'NouveauMotDePasse1',
        password_confirmation: 'NouveauMotDePasse1',
      })
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.notEqual(user.password, 'NouveauMotDePasse1') // jamais en clair
    assert.isTrue(await hash.verify(user.password, 'NouveauMotDePasse1'))
  })
})

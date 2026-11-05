// POLICIES (Bouncer), RECHERCHE DE MEMBRES ET POLITIQUE DE SÉCURITÉ DU CONTENU (CSP)
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Message from '#models/message'
import { bloqueUtilisateur } from '#services/block_service'
import { chercheOuCreeConversationPrivee } from '#services/conversation_service'
import { creeGroupe } from '#services/group'
import { creeUtilisateur } from '../helpers.ts'

test.group('Policies : refus avec un message clair', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("on ne peut plus écrire à quelqu'un qui nous a bloqué (403)", async ({ client, assert }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)
    await bloqueUtilisateur(bob.id, alice.id) // Bob bloque Alice

    const response = await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'Coucou' })
      .withCsrfToken()
      .loginAs(alice)

    response.assertStatus(403)
    // Le message vient de ConversationPolicy, pas le « Access denied » anglais de Bouncer
    assert.equal(response.body().message, "Impossible d'envoyer ce message à cet utilisateur.")
    const messages = await Message.query().where('conversationId', conversation.id)
    assert.lengthOf(messages, 0)
  })

  test("un membre qui n'est pas administrateur ne peut pas supprimer le groupe", async ({
    client,
    assert,
  }) => {
    const admin = await creeUtilisateur('Admin Test')
    const membre1 = await creeUtilisateur('Membre Un')
    const membre2 = await creeUtilisateur('Membre Deux')
    const groupe = await creeGroupe(admin, 'Groupe de test', [membre1.id, membre2.id])

    const response = await client
      .delete(`/groups/${groupe.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(membre1)

    response.assertStatus(403)
    assert.equal(response.body().message, "Seul l'administrateur du groupe peut le supprimer.")
  })
})

test.group('Groupes : recherche des personnes à ajouter', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('la recherche filtre par nom et exclut les membres du groupe', async ({
    client,
    assert,
  }) => {
    const admin = await creeUtilisateur('Admin Test')
    const membre1 = await creeUtilisateur('Membre Un')
    const membre2 = await creeUtilisateur('Membre Deux')
    const zoe = await creeUtilisateur('Zoé Recherchée')
    const groupe = await creeGroupe(admin, 'Groupe de test', [membre1.id, membre2.id])

    const parNom = await client.get('/groups/candidates').qs({ q: 'Recherchée' }).loginAs(admin)
    parNom.assertStatus(200)
    assert.include(parNom.text(), `data-member-id="${zoe.id}"`)
    assert.notInclude(parNom.text(), `data-member-id="${membre1.id}"`)

    // Ajout à un groupe : Zoé est proposée, les membres actuels ne le sont pas
    const pourLeGroupe = await client
      .get('/groups/candidates')
      .qs({ q: 'Recherchée', group: groupe.id })
      .loginAs(admin)
    pourLeGroupe.assertStatus(200)
    assert.include(pourLeGroupe.text(), `data-member-id="${zoe.id}"`)

    const dejaMembre = await client
      .get('/groups/candidates')
      .qs({ q: 'Membre Un', group: groupe.id })
      .loginAs(admin)
    assert.notInclude(dejaMembre.text(), `data-member-id="${membre1.id}"`)
  })

  test("on ne peut pas chercher pour un groupe dont on n'est pas membre (404)", async ({
    client,
  }) => {
    const admin = await creeUtilisateur('Admin Test')
    const membre1 = await creeUtilisateur('Membre Un')
    const membre2 = await creeUtilisateur('Membre Deux')
    const exterieur = await creeUtilisateur('Exterieur Test')
    const groupe = await creeGroupe(admin, 'Groupe de test', [membre1.id, membre2.id])

    const response = await client
      .get('/groups/candidates')
      .qs({ group: groupe.id })
      .loginAs(exterieur)

    response.assertStatus(404)
  })
})

test.group('Sécurité : politique de sécurité du contenu (CSP)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('les pages envoient une CSP et le script en ligne porte son nonce', async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')

    const response = await client.get('/messages').loginAs(alice)

    response.assertStatus(200)
    const csp = String(response.header('content-security-policy'))
    assert.include(csp, "script-src 'self' 'nonce-")
    assert.include(csp, "object-src 'none'")

    const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
    assert.isDefined(nonce)
    assert.include(response.text(), `<script nonce="${nonce}">`)
    assert.notInclude(response.text(), 'onerror=')
  })
})

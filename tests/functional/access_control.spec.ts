// CONTRÔLE D'ACCÈS : un non-membre ne peut ni lire ni écrire dans une conversation ou un groupe.
// Chaque test suit le schéma Préparer → Agir → Vérifier.
// withGlobalTransaction : tout ce qu'un test écrit en base est annulé à la fin du test.

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { chercheOuCreeConversationPrivee } from '../../app/service/conversation_service.ts'
import { creeGroupe } from '../../app/service/group.ts'
import { creeUtilisateur, TEST_PASSWORD } from '../helpers.ts'

test.group('Conversations privées : contrôle d’accès', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un visiteur non connecté est redirigé vers la connexion', async ({ client }) => {
    const response = await client.get('/messages').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('un participant peut ouvrir sa conversation et y écrire', async ({ client, assert }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    const page = await client.get(`/conversations/${conversation.id}`).loginAs(alice)
    page.assertStatus(200)

    const envoi = await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'Bonjour Bob' })
      .withCsrfToken()
      .loginAs(alice)

    envoi.assertStatus(201)
    const messages = await Message.query().where('conversationId', conversation.id)
    assert.lengthOf(messages, 1)
  })

  test('un non-membre ne peut pas lire la conversation (404)', async ({ client }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const intrus = await creeUtilisateur('Intrus Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    const response = await client.get(`/conversations/${conversation.id}`).loginAs(intrus)

    response.assertStatus(404)
  })

  test('un non-membre ne peut pas écrire dans la conversation', async ({ client, assert }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const intrus = await creeUtilisateur('Intrus Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    const response = await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'Je ne devrais pas pouvoir écrire ici' })
      .withCsrfToken()
      .loginAs(intrus)

    response.assertStatus(404)
    const messages = await Message.query().where('conversationId', conversation.id)
    assert.lengthOf(messages, 0)
  })

  test("on ne peut pas supprimer le message d'un autre (403)", async ({ client, assert }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: "Message d'Alice" })
      .withCsrfToken()
      .loginAs(alice)
    const message = await Message.query().where('conversationId', conversation.id).firstOrFail()

    const response = await client
      .delete(`/messages/${message.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(bob)

    response.assertStatus(403)
    await message.refresh()
    assert.isFalse(message.isDeleted)
  })

  test("la recherche ne trouve pas les messages des conversations d'autrui", async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const intrus = await creeUtilisateur('Intrus Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'motsecretintrouvable' })
      .withCsrfToken()
      .loginAs(alice)

    const response = await client.get('/search?q=motsecretintrouvable').loginAs(intrus)

    response.assertStatus(200)
    // Le champ de recherche contient le mot tapé : on vérifie donc l'absence de résultat
    // (un résultat est un lien vers la conversation qui contient le message)
    assert.notInclude(response.text(), `/conversations/${conversation.id}`)
  })
})

test.group('Groupes : contrôle d’accès et gestion des membres', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // Un groupe de 3 personnes : admin (créateur), membre1, membre2, et une personne extérieure
  async function prepareGroupe() {
    const admin = await creeUtilisateur('Admin Test')
    const membre1 = await creeUtilisateur('Membre Un')
    const membre2 = await creeUtilisateur('Membre Deux')
    const exterieur = await creeUtilisateur('Exterieur Test')
    const groupe = await creeGroupe(admin, 'Groupe de test', [membre1.id, membre2.id])
    return { admin, membre1, membre2, exterieur, groupe }
  }

  test('un non-membre ne peut ni lire ni écrire dans le groupe', async ({ client, assert }) => {
    const { exterieur, groupe } = await prepareGroupe()

    const lecture = await client.get(`/groups/${groupe.id}`).loginAs(exterieur)
    lecture.assertStatus(404)

    const ecriture = await client
      .post(`/groups/${groupe.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'intrusion' })
      .withCsrfToken()
      .loginAs(exterieur)
    ecriture.assertStatus(404)

    const messages = await Message.query().where('conversationId', groupe.id)
    assert.lengthOf(messages, 0)
  })

  test("un membre qui n'est pas administrateur ne peut pas ajouter de membre (403)", async ({
    client,
  }) => {
    const { membre1, exterieur, groupe } = await prepareGroupe()

    const response = await client
      .post(`/groups/${groupe.id}/members`)
      .header('Accept', 'application/json')
      .json({ member_ids: [exterieur.id] })
      .withCsrfToken()
      .loginAs(membre1)

    response.assertStatus(403)
  })

  test("un membre qui n'est pas administrateur ne peut pas retirer un membre (403)", async ({
    client,
    assert,
  }) => {
    const { membre1, membre2, groupe } = await prepareGroupe()

    const response = await client
      .delete(`/groups/${groupe.id}/members/${membre2.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(membre1)

    response.assertStatus(403)
    const stillMember = await UserConversation.query()
      .where('conversationId', groupe.id)
      .where('userId', membre2.id)
      .first()
    assert.isNotNull(stillMember)
  })

  test("l'administrateur retire un membre, qui perd aussitôt l'accès au groupe", async ({
    client,
    assert,
  }) => {
    const { admin, membre2, groupe } = await prepareGroupe()

    const retrait = await client
      .delete(`/groups/${groupe.id}/members/${membre2.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(admin)
    retrait.assertStatus(200)

    const membership = await UserConversation.query()
      .where('conversationId', groupe.id)
      .where('userId', membre2.id)
      .first()
    assert.isNull(membership)

    // Le membre retiré ne peut plus ni lire ni écrire
    const lecture = await client.get(`/groups/${groupe.id}`).loginAs(membre2)
    lecture.assertStatus(404)

    const ecriture = await client
      .post(`/groups/${groupe.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'Je suis encore là ?' })
      .withCsrfToken()
      .loginAs(membre2)
    ecriture.assertStatus(404)
  })

  test("le créateur d'un groupe peut supprimer son compte : le groupe passe au plus ancien membre", async ({
    client,
    assert,
  }) => {
    const { admin, membre1, groupe } = await prepareGroupe()

    const response = await client
      .post('/settings/delete-account')
      .header('Accept', 'application/json')
      .json({ password: TEST_PASSWORD })
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(200)
    // La base refuse de supprimer le créateur (RESTRICT) : le code a donc bien transmis le groupe
    await groupe.refresh()
    assert.equal(groupe.createdById, membre1.id)
    const newAdmin = await UserConversation.query()
      .where('conversationId', groupe.id)
      .where('userId', membre1.id)
      .preload('role')
      .firstOrFail()
    assert.equal(newAdmin.role.title, 'admin')
  })

  test("l'administrateur ne peut pas se retirer lui-même", async ({ client }) => {
    const { admin, groupe } = await prepareGroupe()

    const response = await client
      .delete(`/groups/${groupe.id}/members/${admin.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(422)
  })
})

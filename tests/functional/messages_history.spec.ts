// HISTORIQUE ET STATUTS DES MESSAGES : pagination, suppression, statut « reçu »
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Message from '#models/message'
import MessageStatus from '#models/message_status'
import { chercheOuCreeConversationPrivee } from '#services/conversation_service'
import { MESSAGES_PER_PAGE } from '#services/chat_service'
import { marqueMessagesCommeRecus } from '#services/realtime_service'
import { creeMessages, creeUtilisateur } from '../helpers.ts'

test.group('Messages : historique complet (pagination)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('les pages Messages et Groupes s’affichent sans discussion ouverte', async ({ client }) => {
    const alice = await creeUtilisateur('Alice Test')

    const messages = await client.get('/messages').loginAs(alice)
    messages.assertStatus(200)

    const groups = await client.get('/groups').loginAs(alice)
    groups.assertStatus(200)
  })

  test("l'ouverture affiche la dernière page et propose les messages précédents", async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)
    const messages = await creeMessages(conversation.id, alice, MESSAGES_PER_PAGE + 5)

    const page = await client.get(`/conversations/${conversation.id}`).loginAs(alice)

    page.assertStatus(200)
    assert.include(page.text(), 'data-load-older-button')
    // Le plus récent est affiché, le plus ancien ne l'est pas encore
    assert.include(page.text(), `data-message-id="${messages.at(-1)!.id}"`)
    assert.notInclude(page.text(), `data-message-id="${messages[0].id}"`)
  })

  test('« messages précédents » renvoie les plus anciens, puis plus rien', async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)
    const messages = await creeMessages(conversation.id, alice, MESSAGES_PER_PAGE + 5)
    const oldestDisplayed = messages[5] // la première page contient les 50 derniers

    const response = await client
      .get(`/conversations/${conversation.id}/messages`)
      .qs({ before: oldestDisplayed.id })
      .header('Accept', 'application/json')
      .loginAs(bob)

    response.assertStatus(200)
    const body = response.body()
    assert.isFalse(body.hasMore)
    assert.equal(body.oldestId, messages[0].id)
    for (const message of messages.slice(0, 5)) {
      assert.include(body.html, `data-message-id="${message.id}"`)
    }
    assert.notInclude(body.html, `data-message-id="${oldestDisplayed.id}"`)
  })

  test('un non-membre ne peut pas lire les messages précédents (404)', async ({ client }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const intrus = await creeUtilisateur('Intrus Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)
    const [message] = await creeMessages(conversation.id, alice, 2)

    const response = await client
      .get(`/conversations/${conversation.id}/messages`)
      .qs({ before: message.id + 1 })
      .header('Accept', 'application/json')
      .loginAs(intrus)

    response.assertStatus(404)
  })
})

test.group('Messages : suppression et statut « reçu »', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un message supprimé ne garde pas son texte en base', async ({ client, assert }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)
    const [message] = await creeMessages(conversation.id, alice, 1)

    const response = await client
      .delete(`/messages/${message.id}`)
      .header('Accept', 'application/json')
      .withCsrfToken()
      .loginAs(alice)

    response.assertStatus(200)
    await message.refresh()
    assert.isTrue(Boolean(message.isDeleted))
    assert.isNull(message.content)
  })

  test('un message envoyé à une personne en ligne est « reçu », sinon « envoyé »', async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bobEnLigne = await creeUtilisateur('Bob Test')
    bobEnLigne.isOnline = true
    await bobEnLigne.save()
    const chloeHorsLigne = await creeUtilisateur('Chloe Test')

    const avecBob = await chercheOuCreeConversationPrivee(alice, bobEnLigne)
    const avecChloe = await chercheOuCreeConversationPrivee(alice, chloeHorsLigne)

    for (const conversation of [avecBob, avecChloe]) {
      const envoi = await client
        .post(`/conversations/${conversation.id}/messages`)
        .header('Accept', 'application/json')
        .json({ content: 'Bonjour' })
        .withCsrfToken()
        .loginAs(alice)
      envoi.assertStatus(201)
    }

    const statutBob = await MessageStatus.findByOrFail('userId', bobEnLigne.id)
    const statutChloe = await MessageStatus.findByOrFail('userId', chloeHorsLigne.id)
    assert.equal(statutBob.status, 'delivered')
    assert.equal(statutChloe.status, 'sent')
  })

  test('à sa connexion, les messages en attente passent en « reçu »', async ({
    client,
    assert,
  }) => {
    const alice = await creeUtilisateur('Alice Test')
    const bob = await creeUtilisateur('Bob Test')
    const conversation = await chercheOuCreeConversationPrivee(alice, bob)

    const envoi = await client
      .post(`/conversations/${conversation.id}/messages`)
      .header('Accept', 'application/json')
      .json({ content: 'Tu es là ?' })
      .withCsrfToken()
      .loginAs(alice)
    envoi.assertStatus(201)

    // Bob ouvre l'application (start/transmit.ts appelle cette fonction à sa connexion)
    await marqueMessagesCommeRecus(bob.id)

    const message = await Message.query().where('conversationId', conversation.id).firstOrFail()
    const statut = await MessageStatus.query()
      .where('messageId', message.id)
      .where('userId', bob.id)
      .firstOrFail()
    assert.equal(statut.status, 'delivered')
    assert.isFalse(Boolean(statut.isRead))
  })
})

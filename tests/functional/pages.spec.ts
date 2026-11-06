// PAGES PUBLIQUES : pied de page et page d'erreur
import { test } from '@japa/runner'

const MENTION = "© 2026 Kadea Chat · Projet chef-d'œuvre Kadea Academy"

test.group('Pages publiques : mentions du pied de page', () => {
  test("l'accueil, la connexion et la page d'erreur affichent la bonne mention", async ({
    client,
    assert,
  }) => {
    for (const adresse of ['/', '/login', '/adresse-qui-n-existe-pas']) {
      const page = await client.get(adresse)
      // Edge échappe l'apostrophe : on compare avec le texte affiché
      const texte = page.text().replaceAll('&#39;', "'").replaceAll('&#x27;', "'")
      assert.include(texte, MENTION, adresse)
      assert.notInclude(texte, 'NMS Tech', adresse)
    }
  })

  test('une adresse inconnue renvoie la page 404 du site', async ({ client, assert }) => {
    const page = await client.get('/adresse-qui-n-existe-pas')

    page.assertStatus(404)
    assert.include(page.text(), 'Page introuvable')
  })
})

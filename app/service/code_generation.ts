// CODES DES LIENS ENVOYÉS PAR E-MAIL
// Le code est envoyé en clair dans l'e-mail, mais la base n'en garde qu'une version hachée (hash.make) :
// même si quelqu'un lisait la base, il ne pourrait pas fabriquer un lien valide.
// Pour vérifier un lien, on compare le code reçu au hash avec hash.verify.

import { randomInt } from 'node:crypto'
import { type LucidModel } from '@adonisjs/lucid/types/model'

/**
 * Génère un code alphanumérique unique et vérifie son unicité dans le modèle donné.
 * @param model Le modèle Lucid (ex: Inscription, User, etc.)
 * @param columnName Le nom de la colonne servant de filtre (par défaut: 'codeAleatoire')
 * @param length La longueur du code généré (par défaut: 25)
 */
export async function genereCodeUnique(
  model: LucidModel, // où verifie si le code existe déjà
  columnName: string = 'codeAleatoire',
  length: number = 25
): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let isUnique = false
  let finalCode = ''

  while (!isUnique) {
    let randomPart = ''
    for (let i = 0; i < length; i++) {
      // randomInt (module crypto) : tirage imprévisible, contrairement à Math.random()
      const randomIndex = randomInt(characters.length)
      randomPart += characters[randomIndex]
    }

    finalCode = randomPart

    // Vérification dynamique dans la base de données
    const existingRecord = await model.findBy(columnName, finalCode)

    if (!existingRecord) {
      isUnique = true
    }
  }

  return finalCode
}

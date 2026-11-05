// Outils partagés par les tests
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'

export const TEST_PASSWORD = 'MotDePasse123'

// Crée un compte déjà confirmé, avec une adresse unique (données fictives)
export function creeUtilisateur(fullName: string) {
  return User.create({
    fullName,
    email: `${randomUUID()}@example.com`,
    password: TEST_PASSWORD,
    emailVerifiedAt: DateTime.now(),
  })
}

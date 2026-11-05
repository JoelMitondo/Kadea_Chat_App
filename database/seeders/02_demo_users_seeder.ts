// COMPTES DE DÉMONSTRATION : uniquement en développement.
// Ils permettent de tester la messagerie en local sans passer par l'e-mail de confirmation.
// `environment = ['development']` : ce seeder ne tourne JAMAIS en production ni pendant les tests.
// Données fictives (adresses @example.com, réservées aux exemples).

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import User from '#models/user'

// Mot de passe commun aux comptes de démonstration (8 caractères minimum, comme le validateur)
export const DEMO_PASSWORD = 'KadeaDemo2026'

export default class DemoUsersSeeder extends BaseSeeder {
  static environment = ['development']

  async run() {
    const demoUsers = [
      { fullName: 'Amina Kabila', email: 'amina@example.com' },
      { fullName: 'Benjamin Lukusa', email: 'benjamin@example.com' },
      { fullName: 'Chloé Mbuyi', email: 'chloe@example.com' },
      { fullName: 'David Tshibanda', email: 'david@example.com' },
    ]

    for (const demo of demoUsers) {
      // firstOrCreate : relancer le seeder ne crée pas de doublon.
      // Le mot de passe est haché automatiquement par withAuthFinder (modèle User).
      await User.firstOrCreate(
        { email: demo.email },
        {
          ...demo,
          password: DEMO_PASSWORD,
          emailVerifiedAt: DateTime.now(),
        }
      )
    }
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

// Les migrations de création écrivaient `.notNullable` sans parenthèses : la méthode
// n'était jamais appelée et expired_at acceptait NULL. Cette migration ajoute la
// contrainte NOT NULL sur les bases déjà créées.
export default class extends BaseSchema {
  protected tables = ['inscriptions', 'forgo_passwords']

  async up() {
    for (const tableName of this.tables) {
      // Un code sans date d'expiration est inutilisable : on le supprime avant d'ajouter la contrainte
      this.defer(async (db) => {
        await db.from(tableName).whereNull('expired_at').delete()
      })

      this.schema.alterTable(tableName, (table) => {
        table.timestamp('expired_at').notNullable().alter()
      })
    }
  }

  async down() {
    for (const tableName of this.tables) {
      this.schema.alterTable(tableName, (table) => {
        table.timestamp('expired_at').nullable().alter()
      })
    }
  }
}

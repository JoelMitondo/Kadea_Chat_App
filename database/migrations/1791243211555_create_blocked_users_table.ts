import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blocked_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // L'utilisateur qui initie le blocage
      table
        .uuid('blocker_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      // L'utilisateur qui est bloqué
      table
        .uuid('blocked_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      table.boolean('still_blocked').defaultTo(true)

      // Empêcher les doublons de blocage
      table.unique(['blocker_id', 'blocked_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

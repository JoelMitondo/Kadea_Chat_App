import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'message_recipients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Clés étrangères
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      table
        .integer('message_id')
        .unsigned()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
        .notNullable()

      // Empêcher les doublons (un utilisateur reçoit un message précis une seule fois)
      table.unique(['user_id', 'message_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

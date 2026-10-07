import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      // Clés étrangères
      table
        .uuid('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .notNullable()

      table
        .integer('conversation_id')
        .unsigned()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
        .notNullable()

      table
        .integer('message_type_id')
        .unsigned()
        .references('id')
        .inTable('message_types')
        .onDelete('RESTRICT') // Empêche de supprimer un type de message s'il est utilisé
        .notNullable()

      table.text('content').nullable() // J'ai mis nullable car un message pourrait être juste un fichier sans texte
      table.boolean('is_deleted').defaultTo(false)
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Clés étrangères avec contraintes
      table
        .integer('conversation_type_id')
        .unsigned()
        .references('id')
        .inTable('conversation_types')
        .onDelete('CASCADE')
        .notNullable()

      table
        .uuid('created_by_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .notNullable()

      table.string('title').nullable() // Nullable car les conversations privées n'ont pas de titre

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

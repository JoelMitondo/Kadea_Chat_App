import { BaseSchema } from '@adonisjs/lucid/schema'

// La fonctionnalité des stories a été retirée du site : sa table n'a plus d'utilité
export default class extends BaseSchema {
  protected tableName = 'stories'

  async up() {
    this.schema.dropTableIfExists(this.tableName)
  }

  async down() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .uuid('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
      table.string('image_url', 500).notNullable()
      table.string('caption', 150).nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['user_id', 'expires_at'])
      table.index('expires_at')
    })
  }
}

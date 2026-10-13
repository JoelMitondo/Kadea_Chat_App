import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Auteur de la story
      table
        .uuid('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE') // on supprime ,la storie lorsque l'utilisateur est supprimer
        .notNullable()

      table.string('image_url', 500).notNullable()
      table.string('caption', 150).nullable()

      // Une story est visible tant que expires_at est dans le futur (création + 24 h)
      table.timestamp('expires_at', { useTz: true }).notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['user_id', 'expires_at'])
      table.index('expires_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

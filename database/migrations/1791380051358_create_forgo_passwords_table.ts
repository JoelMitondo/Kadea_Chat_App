import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'forgo_passwords'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      table.string('email', 254).notNullable().unique()
      table.string('code_aleatoire').notNullable().unique()
      table.timestamp('expired_at').notNullable

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

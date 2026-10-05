import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_conversations'

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
        .integer('conversation_id')
        .unsigned()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
        .notNullable()

      table
        .integer('last_message_id')
        .unsigned()
        .references('id')
        .inTable('messages')
        .onDelete('SET NULL') // Si le message est supprimé, on met juste à jour ce champ à null
        .nullable()

      table
        .integer('role_id')
        .unsigned()
        .references('id')
        .inTable('role_conversations')
        .onDelete('RESTRICT')
        .notNullable() // Ou .nullable() selon si un rôle par défaut est obligatoire

      // Dates spécifiques au diagramme
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('removed_at', { useTz: true }).nullable()

      // Contrainte d'unicité (un utilisateur ne rejoint une conversation qu'une seule fois)
      table.unique(['user_id', 'conversation_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

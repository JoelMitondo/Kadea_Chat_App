import { BaseSchema } from '@adonisjs/lucid/schema'

// CORRECTION DU SCHÉMA (après relecture des migrations de création)
//
// 1. Clés étrangères contradictoires : `onDelete('SET NULL')` sur des colonnes `notNullable()`.
//    À la suppression d'un utilisateur, PostgreSQL aurait dû mettre NULL dans une colonne qui l'interdit :
//    la suppression aurait échoué. On choisit maintenant une règle cohérente avec deletion_service.ts :
//    - messages.user_id → CASCADE : les messages d'un compte supprimé sont supprimés avec lui
//      (c'est la règle de l'application, la base l'applique aussi) ;
//    - conversations.created_by_id → RESTRICT : la base REFUSE de supprimer le créateur d'un groupe.
//      deletion_service.ts désigne d'abord un nouveau créateur ; si ce code est oublié un jour,
//      on obtient une erreur claire plutôt qu'un groupe supprimé en silence.
//
// 2. Index : les requêtes les plus fréquentes de la messagerie lisaient toute la table.
//    - messages(conversation_id, id) : ouvrir une conversation et charger les messages précédents ;
//    - message_statuses(user_id, is_read) : compteurs de messages non lus ;
//    - message_statuses(user_id, status) : messages « envoyés » qui passent en « reçu » ;
//    - user_conversations(conversation_id) : les membres d'une conversation.
//
// 3. Messages supprimés : leur texte est maintenant effacé à la suppression. On efface aussi
//    celui des messages supprimés AVANT cette correction.
//
// Remarque : `.unsigned()` sur une colonne uuid (migrations de création) n'a aucun effet :
// PostgreSQL n'a pas d'entiers non signés et Knex l'ignore. On le laisse en place, car une migration
// déjà appliquée ne se modifie pas : toute correction passe par une nouvelle migration, comme celle-ci.
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('messages', (table) => {
      table.dropForeign(['user_id'])
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.index(['conversation_id', 'id'], 'messages_conversation_id_id_index')
    })

    this.schema.alterTable('conversations', (table) => {
      table.dropForeign(['created_by_id'])
      table.foreign('created_by_id').references('id').inTable('users').onDelete('RESTRICT')
    })

    this.schema.alterTable('message_statuses', (table) => {
      table.index(['user_id', 'is_read'], 'message_statuses_user_id_is_read_index')
      table.index(['user_id', 'status'], 'message_statuses_user_id_status_index')
    })

    this.schema.alterTable('user_conversations', (table) => {
      table.index(['conversation_id'], 'user_conversations_conversation_id_index')
    })

    this.defer(async (db) => {
      await db.from('messages').where('is_deleted', true).update({ content: null })
    })
  }

  async down() {
    this.schema.alterTable('user_conversations', (table) => {
      table.dropIndex(['conversation_id'], 'user_conversations_conversation_id_index')
    })

    this.schema.alterTable('message_statuses', (table) => {
      table.dropIndex(['user_id', 'status'], 'message_statuses_user_id_status_index')
      table.dropIndex(['user_id', 'is_read'], 'message_statuses_user_id_is_read_index')
    })

    this.schema.alterTable('conversations', (table) => {
      table.dropForeign(['created_by_id'])
      table.foreign('created_by_id').references('id').inTable('users').onDelete('SET NULL')
    })

    this.schema.alterTable('messages', (table) => {
      table.dropIndex(['conversation_id', 'id'], 'messages_conversation_id_id_index')
      table.dropForeign(['user_id'])
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL')
    })
  }
}

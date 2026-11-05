// DONNÉES DE RÉFÉRENCE : indispensables au fonctionnement de l'application.
// Les contrôleurs cherchent ces lignes par leur valeur ("Privee", "admin", "texte"...).
// firstOrCreate rend le seeder rejouable : relancer `node ace db:seed` ne crée pas de doublons.
// Il tourne dans tous les environnements (développement, test et production).

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ConversationType from '#models/conversation_type'
import RoleConversation from '#models/role_conversation'
import MessageType from '#models/message_type'
import {
  ADMIN_ROLE,
  GROUP_TYPE,
  MEMBER_ROLE,
  PRIVATE_TYPE,
} from '../../app/service/chat_service.ts'

// Tables de référence remplies par ce seeder (identifiant auto-incrémenté "id")
const REFERENCE_TABLES = ['conversation_types', 'role_conversations', 'message_types']

export default class ReferenceDataSeeder extends BaseSeeder {
  async run() {
    // PostgreSQL donne les identifiants avec un compteur (une "séquence"). Si des lignes ont été
    // insérées en précisant leur id (insertion manuelle, import...), le compteur n'avance pas :
    // il redonne un id déjà pris et l'insertion échoue ("duplicate key ... _pkey").
    // On recale donc chaque compteur juste après le plus grand id existant.
    for (const table of REFERENCE_TABLES) {
      await this.client.rawQuery(
        `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
        [table]
      )
    }

    const conversationTypes = [
      { type: PRIVATE_TYPE, description: 'Conversation privée entre deux utilisateurs' },
      { type: GROUP_TYPE, description: 'Groupe de discussion (plusieurs membres)' },
    ]
    for (const row of conversationTypes) {
      await ConversationType.firstOrCreate({ type: row.type }, row)
    }

    const roles = [
      { title: ADMIN_ROLE, description: 'Administrateur du groupe : ajoute et retire des membres' },
      { title: MEMBER_ROLE, description: 'Membre de la conversation' },
    ]
    for (const row of roles) {
      await RoleConversation.firstOrCreate({ title: row.title }, row)
    }

    const messageTypes = ['texte', 'images', 'document', 'video', 'emodji']
    for (const type of messageTypes) {
      await MessageType.firstOrCreate({ type }, { type })
    }
  }
}

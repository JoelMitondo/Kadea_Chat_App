import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Conversation from '#models/conversation'
import ConversationType from '#models/conversation_type'
import RoleConversation from '#models/role_conversation'
import UserConversation from '#models/user_conversation'
import { PRIVATE_TYPE } from './chat_service.ts'

/**
 * Renvoie la conversation privée entre deux utilisateurs.
 * Si elle n'existe pas encore, elle est créée (avec les deux participants).
 */
export async function findOrCreatePrivateConversation(
  currentUser: User,
  otherUser: User
): Promise<Conversation> {
  // 1. Existe-t-il déjà une conversation privée où LES DEUX sont participants ?
  const existingConversation = await Conversation.query()
    .whereHas('type', (typeQuery) => {
      typeQuery.where('type', PRIVATE_TYPE)
    })
    .whereHas('participants', (participantQuery) => {
      participantQuery.where('userId', currentUser.id)
    })
    .whereHas('participants', (participantQuery) => {
      participantQuery.where('userId', otherUser.id)
    })
    .first()

  if (existingConversation) {
    return existingConversation
  }

  // 2. Sinon on la crée. Transaction : tout est enregistré ou rien.
  const privateType = await ConversationType.findByOrFail('type', PRIVATE_TYPE)
  const memberRole = await RoleConversation.findByOrFail('title', 'membre')

  return db.transaction(async (trx) => {
    const conversation = await Conversation.create(
      { conversationTypeId: privateType.id, createdById: currentUser.id },
      { client: trx }
    )

    await UserConversation.createMany(
      [
        { conversationId: conversation.id, userId: currentUser.id, roleId: memberRole.id },
        { conversationId: conversation.id, userId: otherUser.id, roleId: memberRole.id },
      ],
      { client: trx }
    )

    return conversation
  })
}

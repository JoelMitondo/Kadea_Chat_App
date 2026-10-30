import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Conversation from '#models/conversation'
import ConversationType from '#models/conversation_type'
import Message from '#models/message'
import RoleConversation from '#models/role_conversation'
import UserConversation from '#models/user_conversation'
import { ADMIN_ROLE, GROUP_TYPE, MEMBER_ROLE } from './chat_service.ts'

/**
 * Crée un groupe : le créateur en est l'administrateur, les autres sont "membres".
 * Transaction : tout est enregistré, ou rien.
 */
export async function creeGroupe(
  creator: User,
  name: string,
  memberIds: string[]
): Promise<Conversation> {
  const groupType = await ConversationType.firstOrCreate({ type: GROUP_TYPE }, { type: GROUP_TYPE })
  const adminRole = await RoleConversation.firstOrCreate(
    { title: ADMIN_ROLE },
    { title: ADMIN_ROLE }
  )
  const memberRole = await RoleConversation.firstOrCreate(
    { title: MEMBER_ROLE },
    { title: MEMBER_ROLE }
  )

  return db.transaction(async (trx) => {
    const conversation = await Conversation.create(
      { conversationTypeId: groupType.id, createdById: creator.id, title: name },
      { client: trx }
    )

    await UserConversation.createMany(
      [
        { conversationId: conversation.id, userId: creator.id, roleId: adminRole.id },
        ...memberIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
          roleId: memberRole.id,
        })),
      ],
      { client: trx }
    )

    return conversation
  })
}

/**
 * Ajoute des membres à un groupe. Ceux qui en font déjà partie sont ignorés.
 * Renvoie la liste des membres réellement ajoutés.
 */
export async function ajouteMembresAuGroupe(
  conversationId: number,
  userIds: string[]
): Promise<string[]> {
  const existingRows = await UserConversation.query()
    .where('conversationId', conversationId)
    .whereIn('userId', userIds)
    .select('user_id')

  const existingIds = existingRows.map((row) => row.userId)
  const newIds = userIds.filter((userId) => !existingIds.includes(userId))

  if (newIds.length === 0) {
    return []
  }

  const memberRole = await RoleConversation.firstOrCreate(
    { title: MEMBER_ROLE },
    { title: MEMBER_ROLE }
  )

  // Les nouveaux membres voient l'historique : leur "dernier message" est celui du groupe
  const lastMessage = await Message.query()
    .where('conversationId', conversationId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .first()

  await UserConversation.createMany(
    newIds.map((userId) => ({
      conversationId,
      userId,
      roleId: memberRole.id,
      lastMessageId: lastMessage?.id ?? null,
    }))
  )

  return newIds
}

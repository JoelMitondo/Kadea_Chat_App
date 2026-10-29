import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Conversation from '#models/conversation'
import ConversationType from '#models/conversation_type'
import RoleConversation from '#models/role_conversation'
import UserConversation from '#models/user_conversation'

// Renvoie la conversation privée entre deux utilisateurs.
// Si elle n'existe pas encore, elle est créée (avec les deux participants).

export async function findOrCreatePrivateConversation(
  currentUser: User,
  otherUser: User
): Promise<Conversation> {
  // Récupérer le type de conversation "Privee" une seule fois
  const privateType = await ConversationType.firstOrCreate({ type: 'Privee' }, { type: 'Privee' })

  // Chercher s'il existe déjà une conversation privée commune aux deux utilisateurs
  const existingConversation = await Conversation.query()
    .where('conversationTypeId', privateType.id)
    .whereHas('participants', (query) => {
      query.where('userId', currentUser.id)
    })
    .whereHas('participants', (query) => {
      query.where('userId', otherUser.id)
    })
    .first()

  // S'assurer qu'il s'agit bien d'une conversation strictement privée à 2 membres
  if (existingConversation) {
    const result = await db
      .from('user_conversations')
      .where('conversation_id', existingConversation.id)
      .count('* as total')

    // Utilisation de Number() pour s'assurer qu'on compare bien un nombre
    const totalParticipants = Number(result[0].total)

    if (totalParticipants === 2) {
      return existingConversation
    }
  }

  // Sinon, on la crée proprement dans une transaction
  const memberRole = await RoleConversation.firstOrCreate({ title: 'membre' }, { title: 'membre' })

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

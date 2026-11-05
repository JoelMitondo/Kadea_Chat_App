// Outils partagés par les tests
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import Message from '#models/message'
import MessageType from '#models/message_type'

export const TEST_PASSWORD = 'MotDePasse123'

// Crée un compte déjà confirmé, avec une adresse unique (données fictives)
export function creeUtilisateur(fullName: string) {
  return User.create({
    fullName,
    email: `${randomUUID()}@example.com`,
    password: TEST_PASSWORD,
    emailVerifiedAt: DateTime.now(),
  })
}

// Crée plusieurs messages texte directement en base (plus rapide que de passer par la route)
export async function creeMessages(conversationId: number, author: User, count: number) {
  const textType = await MessageType.findByOrFail('type', 'texte')
  const messages: Message[] = []
  for (let index = 1; index <= count; index++) {
    messages.push(
      await Message.create({
        conversationId,
        userId: author.id,
        messageTypeId: textType.id,
        content: `Message numéro ${index}`,
      })
    )
  }
  return messages
}

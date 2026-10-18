import db from '@adonisjs/lucid/services/db'
import BlockedUser from '#models/blocked_user'
import Conversation from '#models/conversation'
import ForgoPassword from '#models/forgo_password'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import RoleConversation from '#models/role_conversation'
import Story from '#models/storie'
import User from '#models/user'
import UserConversation from '#models/user_conversation'
import { ADMIN_ROLE, GROUP_TYPE } from './chat_service.ts'
import { deleteFileByUrl } from './cloudinary_service.ts'
import { notifyConversationRemoved, notifyGroupUpdated } from './realtime_service.ts'

// Supprime une liste de fichiers sur Cloudinary (un échec est noté dans les logs, sans rien bloquer)
async function deleteFiles(fileUrls: string[]) {
  for (const fileUrl of fileUrls) {
    await deleteFileByUrl(fileUrl)
  }
}

// ==========================================================
// SUPPRIMER UNE CONVERSATION (utilisé pour supprimer un groupe)
// ==========================================================

/**
 * Supprime une conversation et TOUT ce qu'elle contient :
 * - dans la base de données : ses messages, leurs statuts et pièces jointes, ses participants
 *   (la suppression se fait "en cascade" : supprimer la conversation supprime le reste) ;
 * - sur Cloudinary : les fichiers joints à ses messages.
 * Renvoie la liste des identifiants des participants, pour pouvoir les prévenir.
 */
export async function deleteConversationAndFiles(conversationId: number): Promise<string[]> {
  // 1. Les participants (pour les prévenir ensuite)
  const members = await UserConversation.query()
    .where('conversationId', conversationId)
    .select('user_id')
  const memberIds = members.map((member) => member.userId)

  // 2. Les liens des fichiers joints (à supprimer de Cloudinary après)
  const attachments = await MessageAttachment.query()
    .whereIn('messageId', Message.query().select('id').where('conversationId', conversationId))
    .select('file_path')
  const fileUrls = attachments.map((attachment) => attachment.filePath)

  // 3. La conversation est supprimée de la base (messages et participants avec elle)
  await Conversation.query().where('id', conversationId).delete()

  // 4. Les fichiers sont supprimés de Cloudinary
  await deleteFiles(fileUrls)

  return memberIds
}

// ==========================================================
// SUPPRIMER UN COMPTE
// ==========================================================

/**
 * Supprime définitivement un compte et ce qui lui appartient.
 *
 * RÈGLES :
 * - Ses conversations PRIVÉES sont supprimées (aussi pour l'autre personne).
 * - Dans un GROUPE :
 *     - s'il est le seul membre, le groupe est supprimé ;
 *     - s'il en est l'administrateur, c'est le membre le plus ancien qui devient administrateur ;
 *     - ses messages du groupe sont supprimés.
 * - Sa photo, ses stories et ses fichiers envoyés sont supprimés de Cloudinary.
 * - Ses blocages et ses demandes de mot de passe oublié sont supprimés.
 *
 * Toutes les opérations sur la base sont dans UNE transaction : si une seule échoue,
 * rien n'est supprimé.
 */
export async function deleteUserAccount(user: User): Promise<void> {
  const userId = user.id

  // Les fichiers à supprimer de Cloudinary une fois la base nettoyée
  const fileUrls: string[] = []

  // Les notifications à envoyer une fois la base nettoyée
  const removedPrivateChats: { conversationId: number; otherIds: string[] }[] = []
  const updatedGroups: { conversationId: number; memberIds: string[] }[] = []

  // Sa photo de profil et ses stories
  if (user.avatarUrl) {
    fileUrls.push(user.avatarUrl)
  }
  const stories = await Story.query().where('userId', userId).select('image_url')
  for (const story of stories) {
    fileUrls.push(story.imageUrl)
  }

  const adminRole = await RoleConversation.findByOrFail('title', ADMIN_ROLE)

  // Toutes les conversations (privées et groupes) dont il fait partie
  const memberships = await UserConversation.query()
    .where('userId', userId)
    .preload('role')
    .preload('conversation', (conversationQuery) => {
      conversationQuery.preload('type')
    })

  await db.transaction(async (trx) => {
    for (const membership of memberships) {
      const conversationId = membership.conversationId
      const isGroup = membership.conversation.type.type === GROUP_TYPE

      // Les AUTRES participants de cette conversation, le plus ancien en premier
      const others = await UserConversation.query({ client: trx })
        .where('conversationId', conversationId)
        .whereNot('userId', userId)
        .orderBy('joinedAt', 'asc')
        .orderBy('id', 'asc')

      // ----- CAS 1 : conversation privée, ou groupe où il est seul -----
      // On supprime toute la conversation.
      if (!isGroup || others.length === 0) {
        const attachments = await MessageAttachment.query({ client: trx })
          .whereIn(
            'messageId',
            Message.query({ client: trx }).select('id').where('conversationId', conversationId)
          )
          .select('file_path')
        attachments.forEach((attachment) => fileUrls.push(attachment.filePath))

        await Conversation.query({ client: trx }).where('id', conversationId).delete()

        if (!isGroup) {
          removedPrivateChats.push({
            conversationId,
            otherIds: others.map((other) => other.userId),
          })
        }
        continue
      }

      // ----- CAS 2 : groupe avec d'autres membres -----

      // S'il en est l'administrateur : le membre le plus ancien prend le relais
      if (membership.role.title === ADMIN_ROLE) {
        await UserConversation.query({ client: trx })
          .where('id', others[0].id)
          .update({ role_id: adminRole.id })
      }

      // Le groupe pointe vers son créateur : on le remplace pour que le compte puisse être supprimé
      await Conversation.query({ client: trx })
        .where('id', conversationId)
        .where('createdById', userId)
        .update({ created_by_id: others[0].userId })

      // Ses messages dans ce groupe : fichiers à supprimer, puis messages supprimés
      const ownAttachments = await MessageAttachment.query({ client: trx })
        .whereIn(
          'messageId',
          Message.query({ client: trx })
            .select('id')
            .where('conversationId', conversationId)
            .where('userId', userId)
        )
        .select('file_path')
      ownAttachments.forEach((attachment) => fileUrls.push(attachment.filePath))

      await Message.query({ client: trx })
        .where('conversationId', conversationId)
        .where('userId', userId)
        .delete()

      // "Dernier message" du groupe : on le recalcule (il a pu être supprimé)
      const lastMessage = await Message.query({ client: trx })
        .where('conversationId', conversationId)
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .first()

      await UserConversation.query({ client: trx })
        .where('conversationId', conversationId)
        .update({ last_message_id: lastMessage ? lastMessage.id : null })

      updatedGroups.push({ conversationId, memberIds: others.map((other) => other.userId) })
    }

    // Ses blocages (ceux qu'il a faits et ceux dont il est l'objet)
    await BlockedUser.query({ client: trx })
      .where('blockerId', userId)
      .orWhere('blockedId', userId)
      .delete()

    // Ses demandes de mot de passe oublié
    await ForgoPassword.query({ client: trx }).where('userId', userId).delete()

    // Enfin, le compte lui-même (ses stories partent avec : suppression en cascade)
    await User.query({ client: trx }).where('id', userId).delete()
  })

  // ----- La base est nettoyée : Cloudinary, puis les notifications en temps réel -----

  await deleteFiles(fileUrls)

  for (const chat of removedPrivateChats) {
    notifyConversationRemoved({
      userIds: chat.otherIds,
      conversationId: chat.conversationId,
      kind: 'private',
      message: `${user.fullName} a supprimé son compte : la conversation a été supprimée.`,
    })
  }

  for (const group of updatedGroups) {
    notifyGroupUpdated(group.conversationId, group.memberIds)
  }
}

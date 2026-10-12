import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Message from '#models/message'
import type User from '#models/user'
import UserConversation from '#models/user_conversation'

// Fuseau horaire utilisé pour afficher les heures et calculer "Aujourd'hui" / "Hier"
export const APP_TIMEZONE = 'Africa/Kinshasa'

// Valeur de la colonne "type" de conversation_types pour les conversations 1-to-1
export const PRIVATE_TYPE = 'Privee'
// Valeur de la colonne "type" de conversation_types pour les groupes
export const GROUP_TYPE = 'Publique'

// Valeurs de la colonne "title" de role_conversations
export const ADMIN_ROLE = 'admin'
export const MEMBER_ROLE = 'membre'
// ---------- Dates ----------

function toLocalDate(date: DateTime): DateTime {
  return date.setZone(APP_TIMEZONE).setLocale('fr')
}

// Nombre de jours entre la date et aujourd'hui (0 = aujourd'hui, 1 = hier...)
function getDaysAgo(date: DateTime): number {
  const messageDay = toLocalDate(date).startOf('day')
  const today = DateTime.now().setZone(APP_TIMEZONE).startOf('day')
  return Math.round(today.diff(messageDay, 'days').days)
}

// Clé du jour (ex: "2026-10-12"), pour savoir quand deux messages sont le même jour
export function getDayKey(date: DateTime): string {
  return toLocalDate(date).toFormat('yyyy-MM-dd')
}

export function formatTime(date: DateTime): string {
  return toLocalDate(date).toFormat('HH:mm')
}

// Label du séparateur : Aujourd'hui / Hier / Lundi... / 12/10/2026
export function getDayLabel(date: DateTime): string {
  const daysAgo = getDaysAgo(date)

  if (daysAgo === 0) {
    return "Aujourd'hui"
  }
  if (daysAgo === 1) {
    return 'Hier'
  }
  if (daysAgo > 1 && daysAgo < 7) {
    const weekday = toLocalDate(date).toFormat('cccc') // "lundi"
    return weekday.charAt(0).toUpperCase() + weekday.slice(1) // "Lundi"
  }
  return toLocalDate(date).toFormat('dd/MM/yyyy')
}

// Texte affiché à droite dans la liste : l'heure si c'est aujourd'hui, sinon le label du jour
export function getListTime(date: DateTime): string {
  return getDaysAgo(date) === 0 ? formatTime(date) : getDayLabel(date)
}

// Date au format 12/10/2026
export function formatDate(date: DateTime): string {
  return toLocalDate(date).toFormat('dd/MM/yyyy')
}

// ---------- Présentation ----------

export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
// Ce message est-il le PREMIER que ce participant voit dans la conversation ?
// (conversation sans message, ou supprimée par lui avant ce message)
export function isFirstVisibleMessage(
  previousMessage: Message | null,
  membership: UserConversation
): boolean {
  if (previousMessage === null) {
    return true
  }
  return Boolean(membership.removedAt && previousMessage.createdAt <= membership.removedAt)
}

// Faut-il afficher un séparateur de date ("Aujourd'hui"...) avant ce message ?
export function needsDaySeparator(
  previousMessage: Message | null,
  message: Message,
  membership: UserConversation
): boolean {
  if (previousMessage === null || isFirstVisibleMessage(previousMessage, membership)) {
    return true
  }
  return getDayKey(previousMessage.createdAt) !== getDayKey(message.createdAt)
}
// Extrait du dernier message pour la liste
// Extrait du dernier message pour la liste.
// Dans un groupe (showSender = true) : "Jo : le projet est rendu"
export function buildPreview(
  message: Message,
  currentUserId: User['id'],
  showSender = false
): string {
  if (message.isDeleted) {
    return 'Message supprimé'
  }
  const text = message.content ?? ''

  if (message.userId === currentUserId) {
    return `Vous : ${text}`
  }
  if (showSender && message.user) {
    return `${message.user.fullName} : ${text}`
  }
  return text
}

// Données simples envoyées à la vue pour une bulle de message
export function buildMessageView(message: Message, currentUserId: User['id'], showSender = false) {
  // "statuses" contient (si chargé) les statuts des autres personnes.
  // Le message est "lu" quand TOUS les autres l'ont lu (une seule personne en conversation privée).
  const statuses = message.statuses ?? []
  const isRead = statuses.length > 0 && statuses.every((status) => status.isRead)
  const isMine = message.userId === currentUserId

  return {
    id: message.id,
    content: message.content ?? '',
    isMine,
    isDeleted: message.isDeleted,
    // Pas de colonne "modifié" : si updated_at est plus tard que created_at, le message a été modifié
    isEdited: message.updatedAt.toMillis() - message.createdAt.toMillis() > 1000,
    isRead,
    time: formatTime(message.createdAt),
    dayKey: getDayKey(message.createdAt),
    dayLabel: getDayLabel(message.createdAt),
    // Dans un groupe : nom de l'auteur affiché au-dessus des messages des autres
    senderName: showSender && !isMine ? (message.user?.fullName ?? null) : null,
  }
}
// ---------- Base de données ----------

// Cherche la participation de l'utilisateur à UNE conversation privée.
// Si l'utilisateur n'en fait pas partie, .firstOrFail() renverra une erreur 404.
export function findPrivateMembership(userId: User['id'], conversationId: number) {
  return UserConversation.query()
    .where('userId', userId)
    .where('conversationId', conversationId)
    .whereHas('conversation', (conversationQuery) => {
      conversationQuery.whereHas('type', (typeQuery) => {
        typeQuery.where('type', PRIVATE_TYPE)
      })
    })
}

// Passe en "lu" tous les messages non lus de l'utilisateur dans une conversation
export async function markConversationAsRead(userId: User['id'], conversationId: number) {
  await db
    .from('message_statuses')
    .where('user_id', userId)
    .where('is_read', false)
    .whereIn(
      'message_id',
      db.from('messages').select('id').where('conversation_id', conversationId)
    )
    .update({ is_read: true, status: 'read', updated_at: new Date() })
}

// Même chose que findPrivateMembership, mais pour un GROUPE
export function findGroupMembership(userId: User['id'], conversationId: number) {
  return UserConversation.query()
    .where('userId', userId)
    .where('conversationId', conversationId)
    .whereHas('conversation', (conversationQuery) => {
      conversationQuery.whereHas('type', (typeQuery) => {
        typeQuery.where('type', GROUP_TYPE)
      })
    })
}

// Nombre de messages non lus par conversation (table message_statuses).
// (Déplacé ici depuis ConversationsController pour servir aussi aux groupes.)
export async function getUnreadCounts(userId: User['id'], conversationIds: number[]) {
  const counts = new Map<number, number>()

  if (conversationIds.length === 0) {
    return counts
  }

  const rows = await db
    .from('message_statuses')
    .join('messages', 'messages.id', 'message_statuses.message_id')
    .where('message_statuses.user_id', userId)
    .where('message_statuses.is_read', false)
    .where('messages.is_deleted', false)
    .whereIn('messages.conversation_id', conversationIds)
    .select('messages.conversation_id')
    .count('* as total')
    .groupBy('messages.conversation_id')

  for (const row of rows) {
    counts.set(Number(row.conversation_id), Number(row.total))
  }

  return counts
}

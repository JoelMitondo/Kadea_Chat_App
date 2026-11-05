// BOÎTE À OUTILS DE LA MESSAGERIE
// Fonctions partagées par les conversations privées et les groupes : dates, aperçus, droits d'accès,
// compteurs de non-lus. Les regrouper ici évite d'écrire deux fois le même code dans les contrôleurs.

import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Message from '#models/message'
import type User from '#models/user'
import UserConversation from '#models/user_conversation'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { construitLienTelechargement, construitLienMiniature } from './cloudinary_service.ts'

// Fuseau horaire utilisé pour afficher les heures et calculer "Aujourd'hui" / "Hier"
export const APP_TIMEZONE = 'Africa/Kinshasa'

// Valeur de la colonne "type" de conversation_types pour les conversations 1-to-1
export const PRIVATE_TYPE = 'Privee'
// Valeur de la colonne "type" de conversation_types pour les groupes
export const GROUP_TYPE = 'Publique'

// Valeurs de la colonne "title" de role_conversations
export const ADMIN_ROLE = 'admin'
export const MEMBER_ROLE = 'membre'

// Statuts d'un message pour UN destinataire (colonne "status" de message_statuses) :
// envoyé (enregistré) → reçu (arrivé sur son appareil) → lu (conversation ouverte)
export const STATUS_SENT = 'sent'
export const STATUS_DELIVERED = 'delivered'
export const STATUS_READ = 'read'

// Nombre de messages chargés à la fois (à l'ouverture, puis à chaque « messages précédents »)
export const MESSAGES_PER_PAGE = 50
// ---------- Dates ----------

// Le serveur et la base travaillent en UTC. Pour l'affichage, on convertit à l'heure de Kinshasa,
// sinon "Aujourd'hui" et "Hier" seraient faux autour de minuit.
function convertitEnDateLocale(date: DateTime): DateTime {
  return date.setZone(APP_TIMEZONE).setLocale('fr')
}

// Nombre de jours entre la date et aujourd'hui (0 = aujourd'hui, 1 = hier...)
function donneNombreJoursEcoules(date: DateTime): number {
  const messageDay = convertitEnDateLocale(date).startOf('day')
  const today = DateTime.now().setZone(APP_TIMEZONE).startOf('day')
  return Math.round(today.diff(messageDay, 'days').days)
}

// Clé du jour (ex: "2026-10-12"), pour savoir quand deux messages sont le même jour
export function donneCleDuJour(date: DateTime): string {
  return convertitEnDateLocale(date).toFormat('yyyy-MM-dd')
}

export function formateHeure(date: DateTime): string {
  return convertitEnDateLocale(date).toFormat('HH:mm')
}

// Label du séparateur : Aujourd'hui / Hier / Lundi... / 12/10/2026
export function donneLibelleDuJour(date: DateTime): string {
  const daysAgo = donneNombreJoursEcoules(date)

  if (daysAgo === 0) {
    return "Aujourd'hui"
  }
  if (daysAgo === 1) {
    return 'Hier'
  }
  if (daysAgo > 1 && daysAgo < 7) {
    const weekday = convertitEnDateLocale(date).toFormat('cccc') // "lundi"
    return weekday.charAt(0).toUpperCase() + weekday.slice(1) // "Lundi"
  }
  return convertitEnDateLocale(date).toFormat('dd/MM/yyyy')
}

// Texte affiché à droite dans la liste : l'heure si c'est aujourd'hui, sinon le label du jour
export function donneHeureDeLaListe(date: DateTime): string {
  return donneNombreJoursEcoules(date) === 0 ? formateHeure(date) : donneLibelleDuJour(date)
}

// Date au format 12/10/2026
export function formateDate(date: DateTime): string {
  return convertitEnDateLocale(date).toFormat('dd/MM/yyyy')
}

// ---------- Présentation ----------

export function donneInitiales(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

// Échappe les caractères spéciaux d'une recherche LIKE / ILIKE :
// sans cela, "%" ou "_" tapés par l'utilisateur serviraient de jokers ("%" trouverait tout)
export function protegeCaracteresRecherche(search: string): string {
  return search.replace(/[\\%_]/g, (character) => `\\${character}`)
}

// Taille d'un fichier en texte lisible : "250 Ko", "1.4 Mo"
export function formateTailleFichier(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} o`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// Texte affiché dans la liste quand un message ne contient qu'un fichier
function donneLibelleFichierJoint(message: Message): string {
  const file = message.attachments?.[0]
  if (!file) {
    return ''
  }
  return file.mimeType.startsWith('image/') ? ' Image ' : `Fichier ${file.fileName}`
}
// Ce message est-il le PREMIER que ce participant voit dans la conversation ?
// (conversation sans message, ou supprimée par lui avant ce message)
export function estPremierMessageVisible(
  previousMessage: Message | null,
  membership: UserConversation
): boolean {
  if (previousMessage === null) {
    return true
  }
  return Boolean(membership.removedAt && previousMessage.createdAt <= membership.removedAt)
}

// Faut-il afficher un séparateur de date ("Aujourd'hui"...) avant ce message ?
export function besoinSeparateurDeJour(
  previousMessage: Message | null,
  message: Message,
  membership: UserConversation
): boolean {
  if (previousMessage === null || estPremierMessageVisible(previousMessage, membership)) {
    return true
  }
  return donneCleDuJour(previousMessage.createdAt) !== donneCleDuJour(message.createdAt)
}
// Extrait du dernier message pour la liste
// Extrait du dernier message pour la liste.
// Dans un groupe (showSender = true) : "Jo : le projet est rendu"
export function construitApercu(
  message: Message,
  currentUserId: User['id'],
  showSender = false
): string {
  if (message.isDeleted) {
    return 'Message supprimé'
  }
  const text = message.content || donneLibelleFichierJoint(message)

  if (message.userId === currentUserId) {
    return `Vous : ${text}`
  }
  if (showSender && message.user) {
    return `${message.user.fullName} : ${text}`
  }
  return text
}

// Données simples envoyées à la vue pour une bulle de message
export function construitVueMessage(
  message: Message,
  currentUserId: User['id'],
  showSender = false
) {
  // "statuses" contient (si chargé) les statuts des autres personnes.
  // Le message est "lu" quand TOUS les autres l'ont lu (une seule personne en conversation privée).
  const file = message.attachments?.[0]
  const statuses = message.statuses ?? []
  const isRead = statuses.length > 0 && statuses.every((status) => status.isRead)
  // "Reçu" quand il est arrivé chez TOUS les destinataires (un message lu a forcément été reçu)
  const isDelivered =
    statuses.length > 0 && statuses.every((status) => status.status !== STATUS_SENT)
  const isMine = message.userId === currentUserId

  return {
    id: message.id,
    content: message.content ?? '',
    isMine,
    isDeleted: message.isDeleted,
    // Pas de colonne "modifié" : si updated_at est plus tard que created_at, le message a été modifié
    isEdited: message.updatedAt.toMillis() - message.createdAt.toMillis() > 1000,
    isRead,
    isDelivered,
    time: formateHeure(message.createdAt),
    dayKey: donneCleDuJour(message.createdAt),
    dayLabel: donneLibelleDuJour(message.createdAt),
    // Dans un groupe : nom de l'auteur affiché au-dessus des messages des autres
    senderName: showSender && !isMine ? (message.user?.fullName ?? null) : null,
    // Le fichier joint (image ou document), s'il y en a un
    attachment: file
      ? {
          name: file.fileName,
          size: formateTailleFichier(file.fileSize),
          isImage: file.mimeType.startsWith('image/'),
          url: file.filePath, // le lien d'origine : pour ouvrir l'image ou le document
          thumbUrl: construitLienMiniature(file.filePath), // miniature légère d'une image
          downloadUrl: construitLienTelechargement(file.filePath), // lien qui force le téléchargement
        }
      : null,
  }
}
// ---------- Base de données ----------

// Cherche la participation de l'utilisateur à UNE conversation privée.
// Si l'utilisateur n'en fait pas partie, .firstOrFail() renverra une erreur 404.
// SÉCURITÉ : c'est ici que se vérifie "je ne peux pas accéder à une conversation dont je ne fais pas partie".
// On cherche une ligne dans user_conversations pour CET utilisateur et CETTE conversation.
// Pas de ligne = pas membre : firstOrFail() déclenche une erreur 404, et rien n'est affiché.
export function chercheParticipationPrivee(userId: User['id'], conversationId: number) {
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
export async function marqueConversationCommeLue(userId: User['id'], conversationId: number) {
  await db
    .from('message_statuses')
    .where('user_id', userId)
    .where('is_read', false)
    .whereIn(
      'message_id',
      db.from('messages').select('id').where('conversation_id', conversationId)
    )
    .update({ is_read: true, status: STATUS_READ, updated_at: new Date() })
}

// Même chose que chercheParticipationPrivee, mais pour un GROUPE
export function chercheParticipationGroupe(userId: User['id'], conversationId: number) {
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
// groupBy regroupe les lignes par conversation et count les compte :
// on obtient une seule requête pour toutes les conversations, au lieu d'une requête par conversation.
export async function donneNombreMessagesNonLus(userId: User['id'], conversationIds: number[]) {
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

// ---------- Pagination des messages ----------

/**
 * Charge UNE page de messages d'une conversation, du plus ancien au plus récent.
 * - before : identifiant du plus ancien message déjà affiché (pagination « par curseur »).
 *   Les identifiants augmentent avec le temps : « plus ancien » = « identifiant plus petit ».
 *   Contrairement à un numéro de page, le curseur ne se décale pas quand de nouveaux messages arrivent.
 * - visibleAfter : date de suppression de la conversation par l'utilisateur (messages plus anciens cachés).
 * - prepare : ajoute à la requête ce qui dépend de l'écran (preload des fichiers, des statuts...).
 * On demande UN message de plus que la page : s'il existe, il reste des messages plus anciens.
 */
export async function chargePageMessages(options: {
  conversationId: number
  before: number | null
  visibleAfter: DateTime | null
  prepare: (query: ModelQueryBuilderContract<typeof Message>) => void
}) {
  const query = Message.query()
    .where('conversationId', options.conversationId)
    .orderBy('id', 'desc')
    .limit(MESSAGES_PER_PAGE + 1)

  if (options.before !== null) {
    query.where('id', '<', options.before)
  }
  if (options.visibleAfter !== null) {
    query.where('createdAt', '>', options.visibleAfter.toJSDate())
  }
  options.prepare(query)

  const rows = await query
  const hasMore = rows.length > MESSAGES_PER_PAGE
  const messages = rows.slice(0, MESSAGES_PER_PAGE).reverse()

  return { messages, hasMore, oldestId: messages[0]?.id ?? null }
}

/**
 * Faut-il retirer le séparateur de jour déjà affiché en haut de la discussion ?
 * Oui si le dernier message de la page chargée est du même jour que le premier message affiché :
 * sinon « Aujourd'hui » apparaîtrait deux fois.
 */
export async function memeJourQueLePremierAffiche(
  olderMessages: Message[],
  conversationId: number,
  firstDisplayedId: number
) {
  const lastOlder = olderMessages.at(-1)
  if (!lastOlder) {
    return false
  }
  const firstDisplayed = await Message.query()
    .where('conversationId', conversationId)
    .where('id', firstDisplayedId)
    .first()
  return (
    firstDisplayed !== null &&
    donneCleDuJour(firstDisplayed.createdAt) === donneCleDuJour(lastOlder.createdAt)
  )
}

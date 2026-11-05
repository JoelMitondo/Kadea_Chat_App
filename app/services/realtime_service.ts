// TEMPS RÉEL : ENVOI DES ÉVÉNEMENTS
// Toutes les notifications instantanées partent d'ici. Le principe est toujours le même :
//   1. le contrôleur enregistre d'abord en base de données ;
//   2. il appelle une fonction "previens..." de ce fichier ;
//   3. l'événement part sur le canal personnel de chaque destinataire ;
//   4. dans le navigateur, realtime.js le reçoit et message.js met la page à jour.
// Le HTML est fabriqué ici, côté serveur, pour réutiliser les mêmes vues Edge qu'au chargement de la page.

import edge from 'edge.js'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type User from '#models/user'
import type UserConversation from '#models/user_conversation'
import {
  STATUS_DELIVERED,
  STATUS_READ,
  STATUS_SENT,
  construitVueMessage,
  construitApercu,
  donneInitiales,
  donneHeureDeLaListe,
  estPremierMessageVisible,
  besoinSeparateurDeJour,
} from '#services/chat_service'

// Canal où l'on annonce qui passe en ligne / hors ligne
export const PRESENCE_CHANNEL = 'presence'

export type ConversationKind = 'private' | 'group'

// ---------- Canaux ----------

// Un nom de canal ne peut contenir que des lettres, des chiffres et "/".
// Nos identifiants sont des uuid avec des tirets : on les retire.
export function convertitEnIdentifiantCanal(userId: string): string {
  return userId.replaceAll('-', '')
}

// Chaque utilisateur a son canal personnel : seul lui peut s'y abonner (voir start/transmit.ts)
export function donneCanalUtilisateur(userId: string): string {
  return `users/${convertitEnIdentifiantCanal(userId)}`
}

// Envoie un événement au navigateur d'UN utilisateur.
// Un problème de temps réel ne doit JAMAIS faire échouer l'action de l'utilisateur
// (par exemple l'envoi d'un message) : on note l'erreur dans les logs et on continue.
function envoieAUtilisateur(
  userId: string,
  event: NonNullable<Parameters<typeof transmit.broadcast>[1]>
) {
  try {
    transmit.broadcast(donneCanalUtilisateur(userId), event)
  } catch (error) {
    logger.error({ err: error, userId }, "Échec de l'envoi d'un événement temps réel")
  }
}

// ---------- Présence (en ligne / hors ligne) ----------

export function annoncePresence(userId: string, isOnline: boolean) {
  try {
    transmit.broadcast(PRESENCE_CHANNEL, { type: 'presence', userId, isOnline })
  } catch (error) {
    logger.error({ err: error }, "Échec de l'annonce de présence")
  }
}

// ---------- Nouveau message ----------

/**
 * Prévient tous les AUTRES participants qu'un message vient d'être envoyé.
 * Pour chaque destinataire, on fabrique déjà le HTML de la bulle (côté serveur) :
 * le navigateur n'a plus qu'à l'insérer dans la page.
 */
export async function previensNouveauMessage(options: {
  message: Message // le message tout juste créé, avec son auteur chargé (message.user)
  sender: User
  kind: ConversationKind
  conversationName: string | null // titre du groupe (null pour une conversation privée)
  previousMessage: Message | null // le message précédent de la conversation
  recipients: UserConversation[] // les autres participants
}) {
  const { message, sender, kind, conversationName, previousMessage, recipients } = options
  const isGroup = kind === 'group'

  for (const recipient of recipients) {
    // try/catch par destinataire : si l'un échoue, les autres sont quand même prévenus
    try {
      // La bulle, vue par CE destinataire (message reçu, avec le nom de l'auteur dans un groupe)
      const html = await edge.render('partials/message-item', {
        message: construitVueMessage(message, recipient.userId, isGroup),
        showSeparator: besoinSeparateurDeJour(previousMessage, message, recipient),
      })

      const preview = construitApercu(message, recipient.userId, isGroup)
      const time = donneHeureDeLaListe(message.createdAt)

      // Si c'est le premier message qu'il voit dans cette conversation, elle n'est pas encore
      // dans sa liste : on lui envoie aussi la ligne de liste toute prête.
      let itemHtml: string | null = null
      if (estPremierMessageVisible(previousMessage, recipient)) {
        const item = isGroup
          ? {
              id: message.conversationId,
              name: conversationName ?? 'Groupe sans nom',
              initials: donneInitiales(conversationName ?? 'Groupe'),
              preview,
              time,
              unreadCount: 0,
            }
          : {
              id: message.conversationId,
              userId: sender.id,
              name: sender.fullName,
              initials: donneInitiales(sender.fullName),
              avatarUrl: sender.avatarUrl,
              isOnline: sender.isOnline,
              preview,
              time,
              unreadCount: 0,
            }
        itemHtml = await afficheLigneListe(item, isGroup)
      }

      envoieAUtilisateur(recipient.userId, {
        type: 'message:new',
        kind,
        conversationId: message.conversationId,
        conversationName,
        messageId: message.id,
        senderName: sender.fullName,
        preview,
        time,
        html,
        itemHtml,
      })
    } catch (error) {
      logger.error({ err: error, userId: recipient.userId }, 'Échec de la notification de message')
    }
  }
}

// ---------- Message modifié ou supprimé ----------

export async function previensMessageModifie(options: {
  message: Message // avec son auteur chargé (message.user)
  kind: ConversationKind
  isLast: boolean // est-ce le dernier message de la conversation ? (pour l'aperçu de la liste)
  recipients: UserConversation[]
}) {
  const { message, kind, isLast, recipients } = options
  const isGroup = kind === 'group'

  for (const recipient of recipients) {
    try {
      const html = await edge.render('partials/message-item', {
        message: construitVueMessage(message, recipient.userId, isGroup),
        showSeparator: false, // on remplace une bulle existante : pas de nouveau séparateur
      })

      envoieAUtilisateur(recipient.userId, {
        type: 'message:updated',
        kind,
        conversationId: message.conversationId,
        messageId: message.id,
        html,
        isLast,
        preview: construitApercu(message, recipient.userId, isGroup),
        time: donneHeureDeLaListe(message.createdAt),
      })
    } catch (error) {
      logger.error(
        { err: error, userId: recipient.userId },
        'Échec de la notification de modification'
      )
    }
  }
}

// ---------- Groupes ----------

/**
 * Prévient des personnes qu'elles viennent d'être ajoutées à un groupe (création ou ajout ultérieur) :
 * le groupe apparaît tout de suite dans leur liste.
 */
export async function previensConversationAjoutee(options: {
  conversation: Conversation
  userIds: string[]
  lastMessage: Message | null // dernier message du groupe, avec son auteur chargé (null si aucun)
}) {
  const { conversation, userIds, lastMessage } = options
  const name = conversation.title ?? 'Groupe sans nom'

  for (const userId of userIds) {
    try {
      const itemHtml = await afficheLigneListe(
        {
          id: conversation.id,
          name,
          initials: donneInitiales(name),
          preview: lastMessage ? construitApercu(lastMessage, userId, true) : 'Aucun message',
          time: lastMessage ? donneHeureDeLaListe(lastMessage.createdAt) : '',
          unreadCount: 0,
        },
        true
      )

      envoieAUtilisateur(userId, {
        type: 'conversation:added',
        kind: 'group',
        conversationId: conversation.id,
        conversationName: name,
        itemHtml,
      })
    } catch (error) {
      logger.error({ err: error, userId }, "Échec de la notification d'ajout au groupe")
    }
  }
}

// Prévient les membres existants que la composition du groupe a changé
export function previensGroupeModifie(conversationId: number, userIds: string[]) {
  for (const userId of userIds) {
    envoieAUtilisateur(userId, { type: 'group:updated', kind: 'group', conversationId })
  }
}

// ---------- Lecture des messages ----------

/**
 * Marque comme lus les messages d'une conversation pour un utilisateur,
 * puis prévient leurs auteurs pour que leurs coches passent en bleu.
 */
// Cette fonction est appelée quand quelqu'un ouvre une conversation ou y reçoit un message sous ses yeux.
export async function marqueConversationCommeLueEtPrevient(userId: string, conversationId: number) {
  // 1. Les messages de cette conversation que l'utilisateur n'a pas encore lus
  const unreadRows = await db
    .from('message_statuses')
    .where('user_id', userId)
    .where('is_read', false)
    .whereIn(
      'message_id',
      db.from('messages').select('id').where('conversation_id', conversationId)
    )
    .select('message_id')

  if (unreadRows.length === 0) {
    return // rien de nouveau : inutile de continuer
  }

  const messageIds = unreadRows.map((row) => row.message_id as number)

  // 2. On les passe en "lu"
  await db
    .from('message_statuses')
    .where('user_id', userId)
    .whereIn('message_id', messageIds)
    .update({ is_read: true, status: STATUS_READ, updated_at: new Date() })

  // 3. Parmi eux, lesquels sont maintenant lus par TOUS leurs destinataires ?
  // (dans un groupe, la coche devient bleue seulement quand tout le monde a lu)
  // whereNotExists = "garde les messages pour lesquels il N'EXISTE PAS de statut non lu".
  // Autrement dit : tous les destinataires les ont lus.
  const fullyReadMessages = await db
    .from('messages')
    .whereIn('id', messageIds)
    .whereNotExists((query) => {
      query
        .from('message_statuses')
        .whereRaw('message_statuses.message_id = messages.id')
        .where('message_statuses.is_read', false)
    })
    .select('id', 'user_id')

  // 4. On regroupe par auteur et on prévient chaque auteur
  const idsByAuthor = new Map<string, number[]>()
  for (const row of fullyReadMessages) {
    const authorId = row.user_id as string
    idsByAuthor.set(authorId, [...(idsByAuthor.get(authorId) ?? []), row.id as number])
  }

  for (const [authorId, ids] of idsByAuthor) {
    envoieAUtilisateur(authorId, { type: 'messages:read', conversationId, messageIds: ids })
  }
}

// ---------- Réception des messages ----------

/**
 * Appelée quand un utilisateur se connecte (il ouvre une page de l'application) :
 * les messages qui l'attendaient (statut « envoyé ») sont maintenant arrivés chez lui.
 * Ils passent en « reçu », et leurs auteurs voient deux coches grises.
 */
export async function marqueMessagesCommeRecus(userId: string) {
  // 1. Les messages encore « envoyés » à cet utilisateur
  const waitingRows = await db
    .from('message_statuses')
    .where('user_id', userId)
    .where('status', STATUS_SENT)
    .select('message_id')

  if (waitingRows.length === 0) {
    return
  }

  const messageIds = waitingRows.map((row) => row.message_id as number)

  // 2. On les passe en « reçu »
  await db
    .from('message_statuses')
    .where('user_id', userId)
    .whereIn('message_id', messageIds)
    .where('status', STATUS_SENT)
    .update({ status: STATUS_DELIVERED, updated_at: new Date() })

  // 3. Ceux qui sont maintenant reçus par TOUS leurs destinataires (dans un groupe, il faut tout le monde)
  const fullyDelivered = await db
    .from('messages')
    .whereIn('id', messageIds)
    .whereNotExists((query) => {
      query
        .from('message_statuses')
        .whereRaw('message_statuses.message_id = messages.id')
        .where('message_statuses.status', STATUS_SENT)
    })
    .select('id', 'user_id')

  // 4. On prévient chaque auteur
  const idsByAuthor = new Map<string, number[]>()
  for (const row of fullyDelivered) {
    const authorId = row.user_id as string
    idsByAuthor.set(authorId, [...(idsByAuthor.get(authorId) ?? []), row.id as number])
  }

  for (const [authorId, ids] of idsByAuthor) {
    envoieAUtilisateur(authorId, { type: 'messages:delivered', messageIds: ids })
  }
}

// ---------- Outil ----------

// Fabrique le HTML d'une ligne de la liste des conversations / groupes
function afficheLigneListe(item: Record<string, unknown>, isGroup: boolean): Promise<string> {
  return edge.render('partials/list-item', {
    item,
    chatUrl: isGroup ? '/groups' : '/conversations',
    isGroup,
    canDelete: !isGroup,
  })
}

// ---------- Conversation supprimée ----------

/**
 * Prévient des personnes qu'une conversation (ou un groupe) vient d'être supprimée :
 * elle disparaît de leur liste, et on leur explique pourquoi.
 */
export function previensConversationSupprimee(options: {
  userIds: string[]
  conversationId: number
  kind: ConversationKind
  message: string
}) {
  for (const userId of options.userIds) {
    envoieAUtilisateur(userId, {
      type: 'conversation:removed',
      kind: options.kind,
      conversationId: options.conversationId,
      message: options.message,
    })
  }
}

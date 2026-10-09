import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Message from '#models/message'
import type User from '#models/user'
import UserConversation from '#models/user_conversation'

// Fuseau horaire utilisé pour afficher les heures et calculer "Aujourd'hui" / "Hier"
export const APP_TIMEZONE = 'Africa/Kinshasa'

// Valeur de la colonne "type" de conversation_types pour les conversations 1-to-1
export const PRIVATE_TYPE = 'Privee'

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

// ON GERE LES PRESENTATAIONS
// Pour traiter l'initial du nom d'un utilisateur
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

// Extrait du dernier message pour la liste
export function buildPreview(message: Message, currentUserId: User['id']): string {
  if (message.isDeleted) {
    return 'Message supprimé'
  }
  const text = message.content ?? ''
  return message.userId === currentUserId ? `Vous : ${text}` : text
}

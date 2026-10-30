import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'
import {
  PRESENCE_CHANNEL,
  broadcastPresence,
  toChannelId,
} from '../app/service/realtime_service.ts'

// ===== 1. QUI A LE DROIT DE S'ABONNER À QUEL CANAL ? =====
// Sans règle, n'importe qui pourrait écouter n'importe quel canal. On les protège.

// Canal personnel "users/<id>" : seul son propriétaire peut s'y abonner
transmit.authorize<{ id: string }>('users/:id', (ctx, { id }) => {
  const currentUser = ctx.auth.user
  return currentUser !== undefined && toChannelId(currentUser.id) === id
})

// Canal de présence : toute personne connectée peut l'écouter
transmit.authorize(PRESENCE_CHANNEL, (ctx) => {
  return ctx.auth.user !== undefined
})

// ===== 2. SUIVI DES UTILISATEURS EN LIGNE =====
// Un utilisateur est "en ligne" tant qu'au moins une de ses pages est ouverte
// (donc tant qu'il a au moins une connexion Transmit ouverte).

// uid de la connexion → identifiant de l'utilisateur
const connectionOwners = new Map<string, string>()

// identifiant de l'utilisateur → nombre de connexions ouvertes (un onglet = une connexion)
const connectionCounts = new Map<string, number>()

// identifiant de l'utilisateur → minuteur avant de le passer "hors ligne"
const offlineTimers = new Map<string, NodeJS.Timeout>()

// Quand on change de page, la connexion se ferme puis se rouvre aussitôt.
// On attend donc quelques secondes avant de dire "hors ligne", pour éviter de clignoter.
const OFFLINE_DELAY_MS = 8000

async function setOnlineStatus(userId: string, isOnline: boolean) {
  try {
    await db.from('users').where('id', userId).update({ is_online: isOnline })
    broadcastPresence(userId, isOnline) // tout le monde est prévenu
  } catch (error) {
    logger.error({ err: error, userId }, 'Échec de la mise à jour du statut en ligne')
  }
}

// Une connexion s'ouvre (l'utilisateur a ouvert une page de l'application)
transmit.on('connect', async ({ uid, context }) => {
  const userId = context.auth.user?.id
  if (!userId) {
    return
  }

  connectionOwners.set(uid, userId)

  const pendingTimer = offlineTimers.get(userId)
  const wasOnline = (connectionCounts.get(userId) ?? 0) > 0 || pendingTimer !== undefined

  connectionCounts.set(userId, (connectionCounts.get(userId) ?? 0) + 1)

  // Il est revenu avant la fin du délai : on annule le passage hors ligne
  if (pendingTimer !== undefined) {
    clearTimeout(pendingTimer)
    offlineTimers.delete(userId)
  }

  if (!wasOnline) {
    await setOnlineStatus(userId, true)
  }
})

// Une connexion se ferme (page fermée ou changement de page)
transmit.on('disconnect', ({ uid }) => {
  const userId = connectionOwners.get(uid)
  if (!userId) {
    return
  }
  connectionOwners.delete(uid)

  const remaining = (connectionCounts.get(userId) ?? 1) - 1

  // Il lui reste d'autres onglets ouverts : il est toujours en ligne
  if (remaining > 0) {
    connectionCounts.set(userId, remaining)
    return
  }

  // Plus aucune connexion : hors ligne dans quelques secondes, s'il ne revient pas
  connectionCounts.delete(userId)
  offlineTimers.set(
    userId,
    setTimeout(async () => {
      offlineTimers.delete(userId)
      await setOnlineStatus(userId, false)
    }, OFFLINE_DELAY_MS)
  )
})

// ===== 3. AU DÉMARRAGE DU SERVEUR =====
// Si le serveur s'est arrêté brutalement, certains utilisateurs sont restés "en ligne" en base.
// Au démarrage, plus personne n'est connecté : on remet tout le monde hors ligne.
try {
  await db.from('users').update({ is_online: false })
} catch (error) {
  logger.warn({ err: error }, 'Impossible de réinitialiser les statuts en ligne au démarrage')
}

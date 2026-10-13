import BlockedUser from '#models/blocked_user'

// "blockerId a-t-il bloqué blockedId ?"
export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const row = await BlockedUser.query()
    .where('blockerId', blockerId)
    .where('blockedId', blockedId)
    .first()

  return row !== null
}

// Bloque quelqu'un (s'il est déjà bloqué, rien n'est ajouté une deuxième fois)
export async function blockUser(blockerId: string, blockedId: string) {
  await BlockedUser.firstOrCreate({ blockerId, blockedId })
}

// Débloque quelqu'un
export async function unblockUser(blockerId: string, blockedId: string) {
  await BlockedUser.query().where('blockerId', blockerId).where('blockedId', blockedId).delete()
}

import vine from '@vinejs/vine'

/**
 * Paramètres de la page Utilisateurs : /users?q=marie&page=2
 */
export const searchUsersValidator = vine.create({
  q: vine.string().trim().maxLength(100).optional(),
  page: vine.number().min(1).optional(),
})

/**
 * L'identifiant de l'utilisateur (uuid) dans /users/:id/chat.
 * Sans cette vérification, un identifiant invalide provoquerait une erreur PostgreSQL.
 */
export const chatWithUserValidator = vine.create({
  id: vine.string().uuid(),
})

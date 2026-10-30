import { ConversationSchema } from '#database/schema'
import User from '#models/user'
import ConversationType from '#models/conversation_type'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

// Un modèle représente une table. Les "relations" ci-dessous décrivent les liens avec les autres tables
// et permettent d'écrire .preload('users') pour charger les données liées en une fois.
export default class Conversation extends ConversationSchema {
  @belongsTo(() => ConversationType)
  declare type: BelongsTo<typeof ConversationType>

  @belongsTo(() => User, { foreignKey: 'createdById' })
  declare creator: BelongsTo<typeof User>

  // 1. Les messages de cette conversation
  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>

  // 2. Accès direct à la table pivot (pour voir quand les gens ont rejoint, leurs rôles, etc.)
  @hasMany(() => UserConversation)
  declare participants: HasMany<typeof UserConversation>

  // 3. Raccourci Many-to-Many pour récupérer directement les utilisateurs de la conversation
  @manyToMany(() => User, {
    pivotTable: 'user_conversations',
  })
  declare users: ManyToMany<typeof User>
}

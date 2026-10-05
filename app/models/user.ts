import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Conversation from '#models/conversation'
import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import BlockedUser from '#models/blocked_user'

/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin.
 */
export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  /**
   * Get the user's initials from their full name or email.
   * Returns the first letter of first and last name if available,
   * otherwise returns the first two characters of the email username.
   */
  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }

  // 1. Les conversations créées par cet utilisateur
  @hasMany(() => Conversation, { foreignKey: 'createdById' })
  declare createdConversations: HasMany<typeof Conversation>

  // 2. Les messages envoyés par cet utilisateur
  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>

  // 3. Les conversations auxquelles l'utilisateur participe (relation Many-to-Many pratique)
  @manyToMany(() => Conversation, {
    pivotTable: 'user_conversations',
  })
  declare conversations: ManyToMany<typeof Conversation>

  // 4. Accès direct à la table pivot des participations (si vous avez besoin de récupérer le rôle ou last_message_id)
  @hasMany(() => UserConversation)
  declare participations: HasMany<typeof UserConversation>

  // 5. Les personnes que cet utilisateur a bloquées
  @hasMany(() => BlockedUser, { foreignKey: 'blockerId' })
  declare blocksInitiated: HasMany<typeof BlockedUser>

  // 6. Les personnes qui ont bloqué cet utilisateur
  @hasMany(() => BlockedUser, { foreignKey: 'blockedId' })
  declare blockedBy: HasMany<typeof BlockedUser>
}

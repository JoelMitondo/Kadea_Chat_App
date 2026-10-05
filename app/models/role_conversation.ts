import { RoleConversationSchema } from '#database/schema'
import UserConversation from '#models/user_conversation'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class RoleConversation extends RoleConversationSchema {
  @hasMany(() => UserConversation, { foreignKey: 'roleId' })
  declare userConversations: HasMany<typeof UserConversation>
}

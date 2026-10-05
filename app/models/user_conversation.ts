import { UserConversationSchema } from '#database/schema'
import User from '#models/user'
import Conversation from '#models/conversation'
import Message from '#models/message'
import RoleConversation from '#models/role_conversation'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class UserConversation extends UserConversationSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => Message, { foreignKey: 'lastMessageId' })
  declare lastMessage: BelongsTo<typeof Message>

  @belongsTo(() => RoleConversation, { foreignKey: 'roleId' })
  declare role: BelongsTo<typeof RoleConversation>
}

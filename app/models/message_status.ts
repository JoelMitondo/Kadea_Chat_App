import { MessageStatusSchema } from '#database/schema'
import Message from '#models/message'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class MessageStatus extends MessageStatusSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}

import { MessageRecipientSchema } from '#database/schema'
import User from '#models/user'
import Message from '#models/message'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class MessageRecipient extends MessageRecipientSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>
}

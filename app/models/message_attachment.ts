import { MessageAttachmentSchema } from '#database/schema'
import Message from '#models/message'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class MessageAttachment extends MessageAttachmentSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>
}

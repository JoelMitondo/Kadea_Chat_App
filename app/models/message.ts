import { MessageSchema } from '#database/schema'
import User from '#models/user'
import MessageType from '#models/message_type'
import Conversation from '#models/conversation'
import MessageAttachment from '#models/message_attachment'
import MessageRecipient from '#models/message_recipient'
import MessageStatus from '#models/message_status'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Message extends MessageSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => MessageType)
  declare messageType: BelongsTo<typeof MessageType>

  // 1. Les pièces jointes liées à ce message
  @hasMany(() => MessageAttachment)
  declare attachments: HasMany<typeof MessageAttachment>

  // 2. Les destinataires explicites de ce message
  @hasMany(() => MessageRecipient)
  declare recipients: HasMany<typeof MessageRecipient>

  // 3. Les statuts de lecture/réception pour ce message
  @hasMany(() => MessageStatus)
  declare statuses: HasMany<typeof MessageStatus>
}

import { MessageTypeSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'

export default class MessageType extends MessageTypeSchema {
  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>
}

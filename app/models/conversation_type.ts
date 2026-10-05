import { ConversationTypeSchema } from '#database/schema'
import Conversation from '#models/conversation'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class ConversationType extends ConversationTypeSchema {
  @hasMany(() => Conversation)
  declare conversations: HasMany<typeof Conversation>
}

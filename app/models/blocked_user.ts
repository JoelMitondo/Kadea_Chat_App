import { BlockedUserSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class BlockedUser extends BlockedUserSchema {
  @belongsTo(() => User, { foreignKey: 'blockerId' })
  declare blocker: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'blockedId' })
  declare blocked: BelongsTo<typeof User>
}

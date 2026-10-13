import vine from '@vinejs/vine'

export const searchMessagesValidator = vine.create({
  q: vine.string().trim().maxLength(100).optional(),
})

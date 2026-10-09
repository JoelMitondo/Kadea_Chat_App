import vine from '@vinejs/vine'

export const updateProfileValidator = vine.create({
  full_name: vine.string().trim().minLength(2).maxLength(100),
  bio: vine.string().trim().maxLength(500).optional(),
  phone_number: vine
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/)
    .optional(),
  birth_date: vine.date().beforeOrEqual('today'),
  avatar_url: vine
    .string()
    .trim()
    .url({ protocols: ['http', 'https'], require_protocol: true })
    .optional(),
})

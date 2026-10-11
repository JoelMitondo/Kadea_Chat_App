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
  // Photo facultative : 5 Mo maximum, formats JPG, PNG ou WebP
  avatar: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional(),
})

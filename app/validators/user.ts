import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(50)

export const confirmationCompteValidator = vine.create({
  password: password(),
  phone_number: vine.string().trim().optional(),
  avatar_url: vine
    .string()
    .trim()
    .url({
      protocols: ['http', 'https'],
      require_protocol: true,
    })
    .optional(),
  bio: vine.string().trim().maxLength(500).optional(),
})

export const loginValidator = vine.create({
  email: email(),
  password: password(),
})

import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Validator to use when performing self-signup
 */
export const signupValidator = vine.create({
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

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

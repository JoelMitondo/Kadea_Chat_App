import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

export const inscriptionValidator = vine.create({
  first_name: vine.string().nullable(),
  last_name: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  email_confirmation: email().sameAs('email'),
  birth_date: vine.date(),
})

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

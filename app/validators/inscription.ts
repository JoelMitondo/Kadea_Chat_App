import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

export const inscriptionValidator = vine.create({
  first_name: vine.string(),
  last_name: vine.string(),
  email: email().unique({ table: 'users', column: 'email' }),
  email_confirmation: email().sameAs('email'),
  birth_date: vine.date(),
})

export const loginValidator = vine.create({
  email: email(),
  password: password(),
})

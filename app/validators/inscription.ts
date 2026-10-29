import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const name = () => vine.string().trim().minLength(2).maxLength(50)

export const inscriptionValidator = vine.create({
  first_name: name(),
  last_name: name(),
  email: email().unique({ table: 'users', column: 'email' }),
  email_confirmation: email().sameAs('email'),
  birth_date: vine.date(),
})

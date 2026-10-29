import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(50)

export const forgoPassewordValidator = vine.create({
  email: email(),
})

// confirmed() : le champ "password_confirmation" du formulaire doit être identique
export const newPassewordValidator = vine.create({
  password: password().confirmed(),
})

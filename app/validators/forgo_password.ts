import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(50)

export const forgoPassewordValidator = vine.create({
  email: email(),
})

// confirmed() : le champ "password_confirmation" du formulaire doit être identique
export const newPassewordValidator = vine.create({
  password: password().confirmed(),
})

// Messages d'erreur en français (affichés sous le champ par le formulaire)
newPassewordValidator.messagesProvider = new SimpleMessagesProvider({
  'password.required': 'Saisissez un nouveau mot de passe.',
  'password.minLength': 'Le mot de passe doit contenir au moins {{ min }} caractères.',
  'password.maxLength': 'Le mot de passe ne doit pas dépasser {{ max }} caractères.',
  'password.confirmed': 'Les deux mots de passe ne correspondent pas.',
})

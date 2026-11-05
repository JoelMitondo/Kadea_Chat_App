import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { validationFields, validationMessages } from '#validators/messages'

// Pour supprimer son compte, on redemande le mot de passe
export const deleteAccountValidator = vine.create({
  password: vine.string(),
})

// Changer son mot de passe depuis les paramètres : l'ancien est redemandé,
// le nouveau doit être confirmé (champ password_confirmation) et différent de l'ancien.
export const changePasswordValidator = vine.create({
  current_password: vine.string(),
  password: vine.string().minLength(8).maxLength(50).confirmed().notSameAs('current_password'),
})

changePasswordValidator.messagesProvider = new SimpleMessagesProvider(
  {
    ...validationMessages,
    'current_password.required': 'Saisissez votre mot de passe actuel.',
    'password.required': 'Saisissez un nouveau mot de passe.',
    'password.minLength': 'Le mot de passe doit contenir au moins {{ min }} caractères.',
    'password.maxLength': 'Le mot de passe ne doit pas dépasser {{ max }} caractères.',
    'password.confirmed': 'Les deux mots de passe ne correspondent pas.',
    'password.notSameAs': "Le nouveau mot de passe doit être différent de l'actuel.",
  },
  validationFields
)

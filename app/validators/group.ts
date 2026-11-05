import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { validationFields, validationMessages } from '#validators/messages'

// Création : un nom + au moins 2 membres (avec le créateur, cela fait 3 personnes)
export const createGroupValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(60),
  member_ids: vine.array(vine.string().uuid()).minLength(2).maxLength(100).distinct(),
})

// Ajout de membres à un groupe existant
export const addMembersValidator = vine.create({
  member_ids: vine.array(vine.string().uuid()).minLength(1).maxLength(100).distinct(),
})

// Recherche de personnes à ajouter : /groups/candidates?q=marie&group=12
// group (facultatif) : on exclut les membres de ce groupe
export const searchCandidatesValidator = vine.create({
  q: vine.string().trim().maxLength(100).optional(),
  group: vine.number().withoutDecimals().positive().optional(),
})

// Messages d'erreur en français (si l'un d'eux reste en anglais, sa clé n'a pas été reconnue).
// Les messages communs (validationMessages) sont repris : ce fournisseur remplace le global.
createGroupValidator.messagesProvider = new SimpleMessagesProvider(
  {
    ...validationMessages,
    'name.required': 'Donnez un nom au groupe.',
    'name.minLength': 'Le nom du groupe doit contenir au moins {{ min }} caractères.',
    'name.maxLength': 'Le nom du groupe ne doit pas dépasser {{ max }} caractères.',
    'member_ids.required': 'Sélectionnez au moins deux membres.',
    'member_ids.array.minLength': 'Sélectionnez au moins deux membres pour créer un groupe.',
  },
  validationFields
)

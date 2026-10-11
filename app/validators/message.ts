import vine from '@vinejs/vine'

// Règle commune : texte non vide, 2000 caractères maximum
const content = () => vine.string().trim().minLength(1).maxLength(2000)

export const sendMessageValidator = vine.create({
  content: content(),
})

export const updateMessageValidator = vine.create({
  content: content(),
})

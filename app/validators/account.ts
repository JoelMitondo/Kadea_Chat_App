import vine from '@vinejs/vine'

// Pour supprimer son compte, on redemande le mot de passe
export const deleteAccountValidator = vine.create({
  password: vine.string(),
})

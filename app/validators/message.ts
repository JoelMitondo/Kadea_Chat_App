import vine from '@vinejs/vine'

// Types de fichiers acceptés
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
export const DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
]

// Taille maximale d'un fichier
export const MAX_FILE_SIZE = '10mb'

// Envoi d'un message : un texte, un fichier, ou les deux.
// (le contrôleur vérifie qu'il y a au moins l'un des deux)
export const sendMessageValidator = vine.create({
  content: vine.string().trim().maxLength(2000).optional(),
  attachment: vine
    .file({ size: MAX_FILE_SIZE, extnames: [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS] })
    .optional(),
})

// Modification d'un message : le texte est obligatoire
export const updateMessageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})

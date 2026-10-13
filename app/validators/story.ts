import vine from '@vinejs/vine'

export const createStoryValidator = vine.create({
  // Image obligatoire : 8 Mo maximum, formats JPG, PNG ou WebP
  image: vine.file({ size: '8mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }),
  // Légende facultative
  caption: vine.string().trim().maxLength(150).optional(),
})

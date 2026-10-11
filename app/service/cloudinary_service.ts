import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
console.log('🔍 Test config Cloudinary:', {
  cloud: env.get('CLOUDINARY_CLOUD_NAME'),
  key: env.get('CLOUDINARY_API_KEY'),
  hasSecret: !!env.get('CLOUDINARY_API_SECRET').release(),
})
// Connexion à votre compte Cloudinary
cloudinary.config({
  cloud_name: env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: env.get('CLOUDINARY_API_KEY'),
  api_secret: env.get('CLOUDINARY_API_SECRET').release(),
  secure: true,
})

// Toutes nos images sont rangées sous "kadea-chat/..." sur Cloudinary
const ROOT_FOLDER = 'kadea-chat'

export type ImageFolder = 'avatars' | 'stories' | 'groups' | 'messages'

/**
 * Envoie une image vers Cloudinary.
 * Renvoie le lien (https) à enregistrer en base de données.
 */
export async function uploadImage(
  filePath: string,
  folder: ImageFolder,
  options: UploadApiOptions = {}
): Promise<string> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `${ROOT_FOLDER}/${folder}`,
    resource_type: 'image',
    ...options,
  })

  return result.secure_url
}

/**
 * Photo de profil : redimensionnée en carré 512 x 512 pour économiser l'espace de stockage
 */
export function uploadAvatar(filePath: string): Promise<string> {
  return uploadImage(filePath, 'avatars', {
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
  })
}

/**
 * Supprime sur Cloudinary l'image correspondant à un lien.
 * - Ne lance JAMAIS d'erreur : un échec de suppression ne doit pas bloquer l'utilisateur
 *   (il est simplement enregistré dans les logs).
 * - Ne touche pas aux liens qui ne viennent pas de NOTRE Cloudinary.
 * Renvoie true si l'image a bien été supprimée.
 */
export async function deleteImageByUrl(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl) {
    return false
  }

  const publicId = extractPublicId(imageUrl)
  if (publicId === null) {
    return false
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true, // vide aussi le cache du CDN
    })
    return result.result === 'ok'
  } catch (error) {
    logger.error({ err: error, publicId }, "Échec de la suppression d'une image Cloudinary")
    return false
  }
}

/**
 * Retrouve le "public_id" Cloudinary à partir du lien enregistré.
 *
 * Lien : https://res.cloudinary.com/mon-cloud/image/upload/v1712345678/kadea-chat/avatars/abc123.jpg
 * Public id : kadea-chat/avatars/abc123
 */
function extractPublicId(imageUrl: string): string | null {
  let url: URL
  try {
    url = new URL(imageUrl)
  } catch {
    return null // ce n'est pas un lien valide
  }

  // On ne supprime que les images hébergées sur NOTRE compte Cloudinary
  const cloudName = env.get('CLOUDINARY_CLOUD_NAME')
  const prefix = `/${cloudName}/image/upload/`

  if (url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(prefix)) {
    return null
  }

  const publicId = url.pathname
    .slice(prefix.length) // "v1712345678/kadea-chat/avatars/abc123.jpg"
    .replace(/^v\d+\//, '') // retire la version
    .replace(/\.[^/.]+$/, '') // retire l'extension

  // Sécurité : on ne touche qu'aux images de notre application
  if (!publicId.startsWith(`${ROOT_FOLDER}/`)) {
    return null
  }

  return decodeURIComponent(publicId)
}

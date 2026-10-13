import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

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
// ---------- Stories ----------

/**
 * Story : l'image est réduite si elle dépasse 1080 x 1920 (jamais agrandie, jamais déformée).
 * Cela économise de l'espace de stockage et des données pour ceux qui la regardent.
 */
export function uploadStoryImage(filePath: string): Promise<string> {
  return uploadImage(filePath, 'stories', {
    transformation: [{ width: 1080, height: 1920, crop: 'limit' }],
  })
}

// ---------- Versions d'une même image ----------
// Dans un lien Cloudinary, ce qui suit "/upload/" décrit une transformation à appliquer.
// En insérant un texte à cet endroit, Cloudinary fabrique et sert une autre version de la MÊME
// image, sans qu'on la stocke une deuxième fois. Seul le lien d'origine est enregistré en base.
const UPLOAD_SEGMENT = '/upload/'

// Aperçu : réduit à 48 pixels de large PUIS très flouté (quelques Ko seulement)
// Pour le rendre plus ou moins flou, changez le chiffre après "e_blur:" (1 à 2000).
const BLUR_TRANSFORMATION = 'w_48,c_limit/e_blur:100/q_auto:low,f_auto'

// Version nette : qualité et format choisis automatiquement pour le plus léger possible
const FULL_TRANSFORMATION = 'q_auto,f_auto'

function withTransformation(imageUrl: string, transformation: string): string {
  // Ce n'est pas un lien Cloudinary : on le renvoie tel quel
  if (!imageUrl.includes(UPLOAD_SEGMENT)) {
    return imageUrl
  }
  return imageUrl.replace(UPLOAD_SEGMENT, `${UPLOAD_SEGMENT}${transformation}/`)
}

export function buildBlurUrl(imageUrl: string): string {
  return withTransformation(imageUrl, BLUR_TRANSFORMATION)
}

export function buildFullUrl(imageUrl: string): string {
  return withTransformation(imageUrl, FULL_TRANSFORMATION)
}

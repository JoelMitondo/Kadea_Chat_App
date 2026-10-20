import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { randomUUID } from 'node:crypto'

// Connexion au compte Cloudinary
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
nous envoiyons l'image à cloudinary et lui nous renvoie l'image a enregistrer sur notre bdd
 */
export async function uploadImage(
  filePath: string,
  folder: ImageFolder,
  options: UploadApiOptions = {}
): Promise<string> {
  const result = await cloudinary.uploader.upload(filePath, {
    // Nom complet choisi par nous, dossier compris : le lien contiendra toujours "kadea-chat/..."
    public_id: `${ROOT_FOLDER}/${folder}/${randomUUID()}`,
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
 * Supprime sur Cloudinary le fichier (image OU document) correspondant à un lien.
 * - Ne lance JAMAIS d'erreur : un échec de suppression ne doit pas bloquer l'utilisateur.
 * - Ne touche pas aux liens qui ne viennent pas de NOTRE Cloudinary.
 * Renvoie true si le fichier a bien été supprimé.
 */
export async function deleteFileByUrl(fileUrl: string | null | undefined): Promise<boolean> {
  if (!fileUrl) {
    return false
  }

  const target = extractPublicId(fileUrl)
  if (target === null) {
    return false
  }

  try {
    const result = await cloudinary.uploader.destroy(target.publicId, {
      resource_type: target.resourceType,
      invalidate: true, // vide aussi le cache du CDN
    })
    return result.result === 'ok'
  } catch (error) {
    logger.error(
      { err: error, publicId: target.publicId },
      'Échec de la suppression sur Cloudinary'
    )
    return false
  }
}

// Ancien nom conservé : le reste de votre code (profil, stories) continue de fonctionner
export const deleteImageByUrl = deleteFileByUrl

/**
 * Retrouve le "public_id" Cloudinary à partir du lien enregistré.
 *
 * Image : https://res.cloudinary.com/mon-cloud/image/upload/v1712345678/kadea-chat/avatars/abc123.jpg
 *         → public id : kadea-chat/avatars/abc123            (sans l'extension)
 * Document : https://res.cloudinary.com/mon-cloud/raw/upload/v1712345678/kadea-chat/messages/abc123.pdf
 *         → public id : kadea-chat/messages/abc123.pdf       (AVEC l'extension)
 */
function extractPublicId(
  fileUrl: string
): { publicId: string; resourceType: 'image' | 'raw' } | null {
  let url: URL
  try {
    url = new URL(fileUrl)
  } catch {
    return null // ce n'est pas un lien valide
  }

  if (url.hostname !== 'res.cloudinary.com') {
    return null
  }

  // On ne supprime que les fichiers de NOTRE compte Cloudinary
  const cloudName = env.get('CLOUDINARY_CLOUD_NAME')
  const imagePrefix = `/${cloudName}/image/upload/`
  const rawPrefix = `/${cloudName}/raw/upload/`

  let resourceType: 'image' | 'raw'
  let prefix: string

  if (url.pathname.startsWith(imagePrefix)) {
    resourceType = 'image'
    prefix = imagePrefix
  } else if (url.pathname.startsWith(rawPrefix)) {
    resourceType = 'raw'
    prefix = rawPrefix
  } else {
    return null
  }

  // On retire la version ("v1712345678/")
  let publicId = url.pathname.slice(prefix.length).replace(/^v\d+\//, '')

  // Pour une image, on retire aussi l'extension (pour un document, elle fait partie du nom)
  if (resourceType === 'image') {
    publicId = publicId.replace(/\.[^/.]+$/, '')
  }

  // Sécurité : on ne touche qu'aux fichiers de notre application
  if (!publicId.startsWith(`${ROOT_FOLDER}/`)) {
    return null
  }

  return { publicId: decodeURIComponent(publicId), resourceType }
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

// ---------- Fichiers des messages ----------

/**
 * Envoie un DOCUMENT (pdf, word, excel...) vers Cloudinary.
 * Un document est envoyé en "raw" et son extension fait partie du nom (.pdf, .docx...).
 */
export async function uploadFile(
  filePath: string,
  folder: ImageFolder,
  extension: string
): Promise<string> {
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: `${ROOT_FOLDER}/${folder}/${randomUUID()}.${extension}`,
    resource_type: 'raw',
  })

  return result.secure_url
}

// Miniature d'une image de message : 480 pixels de large au maximum (plus léger à charger)
export function buildThumbUrl(imageUrl: string): string {
  return withTransformation(imageUrl, 'w_480,c_limit,q_auto,f_auto')
}

// Lien qui FORCE le téléchargement du fichier (au lieu de l'ouvrir dans le navigateur)
export function buildDownloadUrl(fileUrl: string): string {
  return withTransformation(fileUrl, 'fl_attachment')
}

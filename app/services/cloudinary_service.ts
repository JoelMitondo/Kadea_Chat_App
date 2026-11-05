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

export type ImageFolder = 'avatars' | 'groups' | 'messages'

// Envoie une image vers Cloudinary et return d'un lien public
export async function envoieImage(
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

// Photo de profil : redimensionnée en carré 512 x 512 pour économiser l'espace de stockage

export function envoiePhotoProfil(filePath: string): Promise<string> {
  return envoieImage(filePath, 'avatars', {
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
  })
}

// Suppression sur Cloudinary le fichier (image ou document) correspondant à un lien.
// Renvoie true si le fichier a bien été supprimé.

export async function supprimeFichierParLien(fileUrl: string | null | undefined): Promise<boolean> {
  if (!fileUrl) {
    return false
  }

  const target = extraitIdentifiantCloudinary(fileUrl)
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

// Ancien nom conservé : le reste de votre code (profil) continue de fonctionner
export const supprimeImageParLien = supprimeFichierParLien

// Extrait l'identifiant Cloudinary à partir du lien enregistré
function extraitIdentifiantCloudinary(
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

// ---------- Versions d'une même image ----------
// Dans un lien Cloudinary, ce qui suit "/upload/" décrit une transformation à appliquer.
// En insérant un texte à cet endroit, Cloudinary fabrique et sert une autre version de la MÊME
// image, sans qu'on la stocke une deuxième fois. Seul le lien d'origine est enregistré en base.
const UPLOAD_SEGMENT = '/upload/'

function ajouteTransformation(imageUrl: string, transformation: string): string {
  // Ce n'est pas un lien Cloudinary : on le renvoie tel quel
  if (!imageUrl.includes(UPLOAD_SEGMENT)) {
    return imageUrl
  }
  return imageUrl.replace(UPLOAD_SEGMENT, `${UPLOAD_SEGMENT}${transformation}/`)
}

// ---------- Fichiers des messages ----------

/**
 * Envoie un DOCUMENT (pdf, word, excel...) vers Cloudinary.
 * Un document est envoyé en "raw" et son extension fait partie du nom (.pdf, .docx...).
 */
export async function envoieDocument(
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
export function construitLienMiniature(imageUrl: string): string {
  return ajouteTransformation(imageUrl, 'w_480,c_limit,q_auto,f_auto')
}

// Lien qui FORCE le téléchargement du fichier (au lieu de l'ouvrir dans le navigateur)
export function construitLienTelechargement(fileUrl: string): string {
  return ajouteTransformation(fileUrl, 'fl_attachment')
}

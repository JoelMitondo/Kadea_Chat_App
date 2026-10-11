import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { updateProfileValidator } from '#validators/profile'
import { deleteImageByUrl, uploadAvatar } from '../service/cloudinary_service.ts'

// Valeurs de la colonne "type" de conversation_types
const TYPE_PRIVATE = 'Privee'
const TYPE_GROUP = 'Publique'

export default class ProfileController {
  /**
   * Affiche la page profil
   */
  async show({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    const privateChats = await this.countConversations(user.id, TYPE_PRIVATE)
    const groups = await this.countConversations(user.id, TYPE_GROUP)
    const messages = await this.countMessages(user.id)

    return view.render('pages/profile', {
      profile: {
        fullName: user.fullName,
        initials: this.getInitials(user.fullName),
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        phoneNumber: user.phoneNumber,
        birthDateInput: user.birthDate?.toFormat('yyyy-MM-dd') ?? '',
        birthDateLabel: this.formatDate(user.birthDate),
        email: user.email,
        createdAt: this.formatDate(user.createdAt),
      },
      stats: { privateChats, groups, messages },
    })
  }

  /**
   * Enregistre les modifications faites dans la modale (y compris la nouvelle photo)
   */
  async update(ctx: HttpContext) {
    const { auth, request, response, session, logger } = ctx
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateProfileValidator)

    // Même règle que l'inscription : 18 ans minimum
    if (!this.isAdult(payload.birth_date)) {
      return this.rejectField(ctx, 'birth_date', 'Vous devez avoir au moins 18 ans.')
    }

    const oldAvatarUrl = user.avatarUrl
    let newAvatarUrl: string | null = null

    // ÉTAPE 1 : s'il y a une nouvelle photo, on l'envoie d'abord vers Cloudinary.
    // Si l'envoi échoue, rien n'a changé : l'ancienne photo est toujours là.
    const avatarTmpPath = payload.avatar?.tmpPath
    if (avatarTmpPath) {
      try {
        newAvatarUrl = await uploadAvatar(avatarTmpPath)
      } catch (error) {
        logger.error({ err: error }, "Échec de l'envoi de la photo vers Cloudinary")
        return this.rejectField(
          ctx,
          'avatar',
          "Impossible d'envoyer la photo pour le moment. Réessayez dans un instant."
        )
      }
    }

    // ÉTAPE 2 : enregistrement en base. On y met le NOUVEAU lien (ou on garde l'ancien).
    try {
      user.merge({
        fullName: payload.full_name,
        bio: payload.bio ?? null,
        phoneNumber: payload.phone_number ?? null,
        birthDate: payload.birth_date,
        avatarUrl: newAvatarUrl ?? oldAvatarUrl,
      })
      await user.save()
    } catch (error) {
      // La base a refusé : la nouvelle image ne sert à rien, on la supprime de Cloudinary
      await deleteImageByUrl(newAvatarUrl)
      throw error
    }

    // ÉTAPE 3 : tout est enregistré, on peut supprimer l'ANCIENNE photo de Cloudinary
    if (newAvatarUrl) {
      await deleteImageByUrl(oldAvatarUrl)
    }

    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message: 'Votre profil a été mis à jour.' })
    }
    session.flash('success', 'Votre profil a été mis à jour.')
    return response.redirect().toRoute('profile')
  }

  // ---------- Méthodes privées ----------

  /** Renvoie une erreur sur un champ précis (JSON pour le formulaire AJAX, message flash sinon) */
  private rejectField(ctx: HttpContext, field: string, message: string) {
    if (ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.unprocessableEntity({ errors: [{ field, message }] })
    }
    ctx.session.flash('error', message)
    return ctx.response.redirect().back()
  }

  /** Nombre de conversations de l'utilisateur pour un type donné */
  private async countConversations(userId: User['id'], typeName: string): Promise<number> {
    const result = await UserConversation.query()
      .where('userId', userId)
      .whereHas('conversation', (conversationQuery) => {
        conversationQuery.whereHas('type', (typeQuery) => {
          typeQuery.where('type', typeName)
        })
      })
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  /** Messages envoyés et reçus : tous les messages des conversations de l'utilisateur */
  private async countMessages(userId: User['id']): Promise<number> {
    const myConversations = UserConversation.query()
      .select('conversation_id')
      .where('user_id', userId)

    const result = await Message.query()
      .whereIn('conversation_id', myConversations)
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  private getInitials(fullName: string): string {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('')
  }

  private formatDate(date: DateTime | null | undefined): string {
    return date ? date.toFormat('dd/MM/yyyy') : 'Non renseignée'
  }

  private isAdult(birthDate: DateTime): boolean {
    return birthDate <= DateTime.now().minus({ years: 18 })
  }
}

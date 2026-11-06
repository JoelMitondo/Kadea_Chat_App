import type { HttpContext } from '@adonisjs/core/http'
import { type DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { updateProfileValidator } from '#validators/profile'
import { supprimeImageParLien, envoiePhotoProfil } from '#services/cloudinary_service'
import {
  AGE_MINIMUM,
  GROUP_TYPE,
  PRIVATE_TYPE,
  donneInitiales,
  estMajeur,
} from '#services/chat_service'

export default class ProfileController {
  // Affichage de la page profil
  async donneProfil({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    const privateChats = await this.compteConversations(user.id, PRIVATE_TYPE)
    const groups = await this.compteConversations(user.id, GROUP_TYPE)
    const messages = await this.compteMessages(user.id)

    return view.render('pages/profile', {
      profile: {
        fullName: user.fullName,
        initials: donneInitiales(user.fullName),
        // ?? '' : Edge affiche null sous la forme du texte "null" dans les champs du formulaire.
        // Le téléphone vide devenait alors "null", refusé par la validation : le profil ne s'enregistrait plus.
        bio: user.bio ?? '',
        avatarUrl: user.avatarUrl,
        phoneNumber: user.phoneNumber ?? '',
        birthDateLabel: this.formateDate(user.birthDate),
        // Le champ <input type="date"> n'accepte que le format AAAA-MM-JJ
        birthDateValue: user.birthDate ? user.birthDate.toISODate() : '',
        email: user.email,
        createdAt: this.formateDate(user.createdAt),
      },
      stats: { privateChats, groups, messages },
    })
  }

  // Enregistre les modifications faites dans la modale (y compris la nouvelle photo)
  async modifieProfil(ctx: HttpContext) {
    const { auth, request, response, session, logger } = ctx
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateProfileValidator)

    // 18 ans minimum
    if (!estMajeur(payload.birth_date)) {
      return this.refuseChamp(ctx, 'birth_date', `Vous devez avoir au moins ${AGE_MINIMUM} ans.`)
    }

    const oldAvatarUrl = user.avatarUrl
    let newAvatarUrl: string | null = null

    // S'il y a une nouvelle photo, on l'envoie d'abord vers Cloudinary.
    // Si l'envoi échoue, rien n'a changé : l'ancienne photo est toujours là.
    const avatarTmpPath = payload.avatar?.tmpPath
    if (avatarTmpPath) {
      try {
        newAvatarUrl = await envoiePhotoProfil(avatarTmpPath)
      } catch (error) {
        logger.error({ err: error }, "Échec de l'envoi de la photo vers Cloudinary")
        return this.refuseChamp(
          ctx,
          'avatar',
          "Impossible d'envoyer la photo pour le moment. Réessayez dans un instant."
        )
      }
    }

    // ENregistrement en base. On y met le NOUVEAU lien (ou on garde l'ancien).
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
      await supprimeImageParLien(newAvatarUrl)
      throw error
    }

    // TOUt est enregistré, on peut supprimer l'ANCIENNE photo de Cloudinary
    if (newAvatarUrl) {
      await supprimeImageParLien(oldAvatarUrl)
    }
    // Formulaire envoyé par le script : il affiche lui-même le message puis recharge la page
    // (un message flash ici s'afficherait une deuxième fois après le rechargement)
    if (request.accepts(['html', 'json']) === 'json') {
      return response.ok({ message: 'Votre profil a été mis à jour.' })
    }
    session.flash('success', 'Votre profil a été mis à jour.')
    return response.redirect().toRoute('profile')
  }

  // Renvoie une erreur sur un champ précis (JSON pour le formulaire AJAX, message flash sinon).
  // Avant, une redirection était renvoyée même au script : il la suivait, recevait un code 200
  // et affichait "Votre profil a été mis à jour" alors que rien n'avait été enregistré.
  private refuseChamp(ctx: HttpContext, field: string, message: string) {
    if (ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.unprocessableEntity({ errors: [{ field, message }] })
    }
    ctx.session.flash('error', message)
    return ctx.response.redirect().back()
  }

  //Nombre de conversations de l'utilisateur pour un type donné
  private async compteConversations(userId: User['id'], typeName: string): Promise<number> {
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

  // Messages envoyés et reçus : tous les messages des conversations de l'utilisateur
  private async compteMessages(userId: User['id']): Promise<number> {
    const myConversations = UserConversation.query()
      .select('conversation_id')
      .where('user_id', userId)

    const result = await Message.query()
      .whereIn('conversation_id', myConversations)
      .where('is_deleted', false) // un message supprimé n'est plus compté
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  private formateDate(date: DateTime | null | undefined): string {
    return date ? date.toFormat('dd/MM/yyyy') : 'Non renseignée'
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import type User from '#models/user'
import Message from '#models/message'
import UserConversation from '#models/user_conversation'
import { updateProfileValidator } from '#validators/profile'

export default class ProfileController {
  async show({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    const privateChats = await this.countConversations(user.id, 'Privee')
    const groups = await this.countConversations(user.id, 'Publique')
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

  //modification du profil de user
  async update({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateProfileValidator)
    const wantsJson = request.accepts(['html', 'json']) === 'json'

    // Même règle que l'inscription : 18 ans minimum
    if (!this.isAdult(payload.birth_date)) {
      const message = 'Vous devez avoir au moins 18 ans.'

      if (wantsJson) {
        return response.unprocessableEntity({ errors: [{ field: 'birth_date', message }] })
      }
      session.flash('error', message)
      return response.redirect().back()
    }

    // si l'utilisateur a rien mentionner sur un champs, on le met à null
    user.merge({
      fullName: payload.full_name,
      bio: payload.bio ?? null,
      phoneNumber: payload.phone_number ?? null,
      birthDate: payload.birth_date,
      avatarUrl: payload.avatar_url ?? null,
    })
    await user.save()

    if (wantsJson) {
      return response.ok({ message: 'Votre profil a été mis à jour.' })
    }
    session.flash('success', 'Votre profil a été mis à jour.')
    return response.redirect().toRoute('profile')
  }

  // ---------- Méthodes privées ----------

  /** Nombre de conversations de l'utilisateur pour un type donné (privée ou groupe) */
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

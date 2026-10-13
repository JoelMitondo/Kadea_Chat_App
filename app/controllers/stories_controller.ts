import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Story from '#models/storie'
import { createStoryValidator } from '#validators/story'
import {
  buildBlurUrl,
  buildFullUrl,
  deleteImageByUrl,
  uploadStoryImage,
} from '../service/cloudinary_service.ts'
import { getInitials } from '../service/chat_service.ts'
import { broadcastNewStory } from '../service/realtime_service.ts'
import {
  MAX_ACTIVE_STORIES,
  STORY_LIFETIME_HOURS,
  formatTimeLeft,
} from '../service/story_service.ts'

// Nombre maximum de stories chargées sur la page (protège la page si beaucoup de monde publie)
const STORIES_LIMIT = 300

// Données d'une story envoyées à la vue : seulement des liens légers, JAMAIS le lien net direct dans <img>
function toStoryView(story: Story) {
  return {
    id: story.id,
    caption: story.caption,
    blurUrl: buildBlurUrl(story.imageUrl), // l'aperçu flou, quelques Ko
    fullUrl: buildFullUrl(story.imageUrl), // la version nette, téléchargée seulement au clic
    postedAgo: story.createdAt.setLocale('fr').toRelative() ?? '', // "il y a 2 heures"
    expiresAt: story.expiresAt.toISO() ?? '', // le navigateur s'en sert pour mettre à jour le temps restant
    timeLeft: formatTimeLeft(story.expiresAt),
  }
}

type StoryView = ReturnType<typeof toStoryView>

interface AuthorView {
  id: string
  fullName: string
  initials: string
  avatarUrl: string | null
  isOnline: boolean
  lastStoryAt: number // sert à classer les auteurs : celui qui a publié en dernier d'abord
  stories: StoryView[]
}

export default class StoriesController {
  /**
   * Page Stories : mes stories + celles de tous les autres utilisateurs
   * - Appel du JavaScript (rafraîchissement) : on renvoie seulement la liste.
   * - Ouverture normale de la page : on renvoie la page complète.
   */
  async index({ auth, request, view }: HttpContext) {
    const user = auth.getUserOrFail()

    // Les stories ACTIVES de tout le monde (celles dont l'expiration est dans le futur)
    const stories = await Story.query()
      .where('expiresAt', '>', new Date())
      .preload('user')
      .orderBy('createdAt', 'desc')
      .limit(STORIES_LIMIT)

    const myStories: StoryView[] = []
    const authorsMap = new Map<string, AuthorView>()

    for (const story of stories) {
      const storyView = toStoryView(story)

      // Mes stories sont affichées à part
      if (story.userId === user.id) {
        myStories.push(storyView)
        continue
      }

      // Les autres sont regroupées par auteur
      let author = authorsMap.get(story.userId)
      if (!author) {
        author = {
          id: story.userId,
          fullName: story.user.fullName,
          initials: getInitials(story.user.fullName),
          avatarUrl: story.user.avatarUrl,
          isOnline: story.user.isOnline ?? false,
          lastStoryAt: story.createdAt.toMillis(), // la première rencontrée est la plus récente
          stories: [],
        }
        authorsMap.set(story.userId, author)
      }
      author.stories.push(storyView)
    }

    // On a chargé du plus récent au plus ancien ; on affiche dans l'ordre chronologique
    myStories.reverse()
    const authors = [...authorsMap.values()]
    for (const author of authors) {
      author.stories.reverse()
    }
    authors.sort((a, b) => b.lastStoryAt - a.lastStoryAt)

    const data = {
      me: { initials: getInitials(user.fullName), avatarUrl: user.avatarUrl },
      myStories,
      authors,
      limits: {
        count: myStories.length,
        max: MAX_ACTIVE_STORIES,
        canAdd: myStories.length < MAX_ACTIVE_STORIES,
        // La plus ancienne de mes stories est la première à expirer
        nextSlotIn: myStories.length > 0 ? myStories[0].timeLeft : '',
      },
    }

    if (request.header('x-requested-with') === 'XMLHttpRequest') {
      return view.render('partials/stories-feed', data)
    }
    return view.render('pages/stories', data)
  }

  /**
   * Publie une nouvelle story
   */
  async store({ auth, request, response, logger }: HttpContext) {
    const user = auth.getUserOrFail()
    const { image, caption } = await request.validateUsing(createStoryValidator)

    // ÉTAPE 1 : l'utilisateur a-t-il déjà 5 stories actives ?
    const activeStories = await Story.query()
      .where('userId', user.id)
      .where('expiresAt', '>', new Date())
      .orderBy('expiresAt', 'asc')

    if (activeStories.length >= MAX_ACTIVE_STORIES) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'image',
            message: `Vous avez déjà ${MAX_ACTIVE_STORIES} stories actives. Une place se libérera dans ${formatTimeLeft(activeStories[0].expiresAt)}.`,
          },
        ],
      })
    }

    // ÉTAPE 2 : envoi de l'image vers Cloudinary
    let imageUrl: string
    try {
      imageUrl = await uploadStoryImage(image.tmpPath!)
    } catch (error) {
      logger.error({ err: error }, "Échec de l'envoi de la story vers Cloudinary")
      return response.unprocessableEntity({
        errors: [
          {
            field: 'image',
            message: "Impossible d'envoyer l'image pour le moment. Réessayez dans un instant.",
          },
        ],
      })
    }

    // ÉTAPE 3 : enregistrement en base (la story expire dans 24 h)
    try {
      await Story.create({
        userId: user.id,
        imageUrl,
        caption: caption ?? null,
        expiresAt: DateTime.now().plus({ hours: STORY_LIFETIME_HOURS }),
      })
    } catch (error) {
      // La base a refusé : l'image ne sert à rien, on la supprime de Cloudinary
      await deleteImageByUrl(imageUrl)
      throw error
    }

    // TEMPS RÉEL : les autres utilisateurs sont prévenus qu'une nouvelle story est disponible
    broadcastNewStory(user)

    return response.created({
      message: 'Votre story est publiée. Elle restera visible pendant 24 h.',
    })
  }
}

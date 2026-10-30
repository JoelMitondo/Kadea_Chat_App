// PAGES D'ERREUR
// Regroupe les textes de toutes les pages d'erreur du site : pour changer un message, c'est ici.

import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { APP_TIMEZONE } from './chat_service.ts'

// Une action proposée sur la page d'erreur (bouton)
interface ErrorAction {
  label: string
  href: string
  primary?: boolean
}

// Les textes d'une page d'erreur (voir resources/views/pages/errors/error.edge)
export interface ErrorPage {
  code: number
  title: string
  message: string
  hint?: string
  icon: 'search' | 'link' | 'clock' | 'lock' | 'server'
  tone: 'primary' | 'warning' | 'danger'
  actions?: ErrorAction[]
  reference?: string
}

// Les pages d'erreur du site, par situation
export const ERROR_PAGES = {
  notFound: {
    code: 404,
    title: 'Page introuvable',
    message:
      "La page que vous cherchez n'existe pas, a été supprimée ou n'est pas accessible avec votre compte.",
    hint: "Vérifiez l'adresse saisie, ou repartez de l'accueil.",
    icon: 'search',
    tone: 'primary',
  },
  forbidden: {
    code: 403,
    title: 'Accès refusé',
    message: "Vous n'avez pas l'autorisation d'accéder à cette page.",
    icon: 'lock',
    tone: 'warning',
  },
  sessionExpired: {
    code: 419,
    title: 'Page expirée',
    message:
      'Cette page est restée ouverte trop longtemps : par sécurité, le formulaire a été refusé.',
    hint: 'Revenez en arrière, rechargez la page, puis recommencez.',
    icon: 'clock',
    tone: 'warning',
  },
  tooLarge: {
    code: 413,
    title: 'Fichier trop lourd',
    message: 'Le fichier envoyé dépasse la taille autorisée (20 Mo au total par envoi).',
    hint: 'Choisissez un fichier plus léger, puis réessayez.',
    icon: 'server',
    tone: 'warning',
  },
  serverError: {
    code: 500,
    title: 'Oups, un problème est survenu',
    message:
      "Le serveur a rencontré une erreur inattendue. Ce n'est pas de votre faute : réessayez dans un instant.",
    hint: 'Si le problème continue, contactez-nous en indiquant la référence ci-dessous.',
    icon: 'server',
    tone: 'danger',
  },

  // ----- Liens reçus par e-mail -----
  signupLinkInvalid: {
    code: 404,
    title: "Lien d'inscription invalide",
    message:
      "Ce lien d'inscription n'est pas valide : il est incomplet, a déjà été utilisé ou a été remplacé par un lien plus récent.",
    hint: "Utilisez le dernier e-mail reçu, ou recommencez l'inscription pour recevoir un nouveau lien.",
    icon: 'link',
    tone: 'warning',
    actions: [
      { label: "Recommencer l'inscription", href: '/register', primary: true },
      { label: 'Se connecter', href: '/login' },
    ],
  },
  signupLinkExpired: {
    code: 410,
    title: "Lien d'inscription expiré",
    message: "Ce lien d'inscription était valable 48 heures et il a expiré.",
    hint: 'Recommencez votre inscription : un nouveau lien vous sera envoyé par e-mail.',
    icon: 'clock',
    tone: 'warning',
    actions: [{ label: "Recommencer l'inscription", href: '/register', primary: true }],
  },
  accountAlreadyExists: {
    code: 409,
    title: 'Compte déjà créé',
    message: 'Un compte existe déjà avec cette adresse e-mail : ce lien ne peut plus servir.',
    hint: 'Connectez-vous avec votre mot de passe, ou utilisez « Mot de passe oublié ».',
    icon: 'lock',
    tone: 'primary',
    actions: [
      { label: 'Se connecter', href: '/login', primary: true },
      { label: 'Mot de passe oublié', href: '/forgoPassword' },
    ],
  },
} satisfies Record<string, ErrorPage>

/**
 * Affiche la page d'erreur du site avec le bon code HTTP.
 * Les boutons par défaut dépendent de la connexion : "Mes messages" ou "Accueil".
 */
export async function affichePageErreur(
  ctx: HttpContext,
  page: ErrorPage,
  overrides: Partial<ErrorPage> = {}
) {
  const data: ErrorPage = { ...page, ...overrides }

  // La session et l'authentification n'existent pas pour une adresse inconnue : on vérifie
  const isLoggedIn = 'auth' in ctx && ctx.auth?.user !== undefined
  data.actions = data.actions ?? [
    isLoggedIn
      ? { label: 'Retour à mes messages', href: '/messages', primary: true }
      : { label: "Retour à l'accueil", href: '/', primary: true },
    isLoggedIn
      ? { label: 'Mon profil', href: '/profile' }
      : { label: 'Se connecter', href: '/login' },
  ]

  // Une référence (date et heure) pour retrouver l'erreur dans les journaux du serveur
  if (data.code >= 500 && !data.reference) {
    data.reference = DateTime.now().setZone(APP_TIMEZONE).toFormat('dd/MM/yyyy HH:mm:ss')
  }

  const html = await ctx.view.render('pages/errors/error', { page: data })
  return ctx.response.status(data.code).send(html)
}

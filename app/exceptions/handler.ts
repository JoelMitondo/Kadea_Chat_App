import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import { ERROR_PAGES, affichePageErreur } from '../service/error_page.ts'

// Messages en français qui remplacent les messages par défaut (en anglais) d'AdonisJS
const FRENCH_MESSAGES: Record<string, string> = {
  // "Invalid user credentials" : mauvais e-mail ou mauvais mot de passe à la connexion
  E_INVALID_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
  // "Unauthorized access" : page réservée aux personnes connectées
  E_UNAUTHORIZED_ACCESS:
    'Votre session a expiré ou vous n’êtes pas connecté. Veuillez vous connecter.',
  // "Invalid or expired CSRF token" : page restée ouverte trop longtemps
  E_BAD_CSRF_TOKEN:
    'Cette page est restée ouverte trop longtemps. Rechargez-la, puis recommencez votre action.',
  // "Row not found" : conversation, message, groupe... introuvable
  E_ROW_NOT_FOUND: "L'élément demandé est introuvable : il a peut-être été supprimé.",
  // "Cannot GET:/..." : adresse inconnue
  E_ROUTE_NOT_FOUND: "Cette adresse n'existe pas.",
  // "request entity too large" : envoi au-dessus de la limite du serveur (20 Mo)
  E_REQUEST_ENTITY_TOO_LARGE: 'Le fichier envoyé est trop lourd (20 Mo maximum par envoi).',
  E_INVALID_MULTIPART_REQUEST: "Le fichier n'a pas pu être envoyé. Réessayez.",
}

// Message affiché pour toute autre erreur serveur : on ne montre jamais le détail technique
const SERVER_ERROR_MESSAGE = 'Une erreur est survenue sur le serveur. Réessayez dans un instant.'

type HttpError = Error & { code?: string; status?: number }

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Pages d'erreur du site, affichées aussi en développement pour les erreurs "utilisateur"
   * (404, 403...). En développement, les erreurs 500 gardent la page détaillée d'AdonisJS
   * (pile d'appels) qui aide à corriger le bug.
   */
  protected renderStatusPages = true

  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, ctx) => affichePageErreur(ctx, ERROR_PAGES.notFound),
    '403': (_, ctx) => affichePageErreur(ctx, ERROR_PAGES.forbidden),
    '413': (_, ctx) => affichePageErreur(ctx, ERROR_PAGES.tooLarge),
    ...(app.inProduction
      ? {
          '500..599': (_: unknown, ctx: HttpContext) =>
            affichePageErreur(ctx, ERROR_PAGES.serverError),
        }
      : {}),
  }

  // Toute erreur non gérée dans l'application arrive ici. Le nom "handle" est imposé par AdonisJS.
  async handle(error: unknown, ctx: HttpContext) {
    const httpError = error as HttpError

    // 1. Message anglais d'AdonisJS → message français clair
    const frenchMessage = httpError?.code ? FRENCH_MESSAGES[httpError.code] : undefined
    if (frenchMessage) {
      httpError.message = frenchMessage
    }

    // 2. Requêtes faites par le JavaScript des pages (fetch) : on répond TOUJOURS en JSON,
    // jamais par une redirection. Sinon fetch suit la redirection, reçoit une page HTML
    // avec le code 200, et le script croit que l'action a réussi.
    if (this.isScriptRequest(ctx) && httpError?.code !== 'E_VALIDATION_ERROR') {
      return this.respondAsJson(httpError, ctx)
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }

  // Le navigateur attend du JSON (Accept) ou la requête vient d'un fetch (X-Requested-With)
  private isScriptRequest(ctx: HttpContext) {
    return (
      ctx.request.header('x-requested-with') === 'XMLHttpRequest' ||
      ctx.request.accepts(['html', 'json']) === 'json'
    )
  }

  private respondAsJson(error: HttpError, ctx: HttpContext) {
    const code = error?.code

    // Jeton CSRF : 419, le code que le JavaScript reconnaît comme "page expirée"
    if (code === 'E_BAD_CSRF_TOKEN') {
      return ctx.response.status(419).send({ message: error.message })
    }

    const status = error?.status && error.status >= 400 ? error.status : 500

    // Erreur serveur : en production, jamais le détail technique (nom de table, requête SQL...)
    if (status >= 500) {
      const message = app.inProduction || !error?.message ? SERVER_ERROR_MESSAGE : error.message
      return ctx.response.status(status).send({ message })
    }

    // Même forme que les erreurs de validation : le JavaScript lit errors[0].message
    return ctx.response
      .status(status)
      .send({ message: error.message, errors: [{ message: error.message }] })
  }
}

// AUTORISATIONS DES CONVERSATIONS ET DES MESSAGES (Bouncer)
// Une "policy" rassemble les règles « qui a le droit de faire quoi » sur une ressource.
// Le contrôleur appelle : await bouncer.with(ConversationPolicy).authorize('supprimerMessage', message)
// Si la règle refuse, Bouncer lève une erreur 403 avec le message ci-dessous (voir app/exceptions/handler.ts).
//
// L'APPARTENANCE à une conversation reste vérifiée par chercheParticipationPrivee / Groupe (404) :
// on ne révèle pas à un non-membre qu'une conversation existe. Les policies décident ensuite
// de ce qu'un membre a le droit de faire (403).

import { AuthorizationResponse, BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Message from '#models/message'
import { aBloque } from '#services/block_service'

export default class ConversationPolicy extends BasePolicy {
  // Seul l'auteur d'un message peut le modifier
  modifierMessage(user: User, message: Message) {
    if (message.userId !== user.id) {
      return AuthorizationResponse.deny('Vous ne pouvez modifier que vos propres messages.')
    }
    return true
  }

  // Seul l'auteur d'un message peut le supprimer
  supprimerMessage(user: User, message: Message) {
    if (message.userId !== user.id) {
      return AuthorizationResponse.deny('Vous ne pouvez supprimer que vos propres messages.')
    }
    return true
  }

  // Conversation privée : on ne peut plus écrire à quelqu'un qui nous a bloqué
  async ecrireA(user: User, otherUserId: User['id']) {
    if (await aBloque(otherUserId, user.id)) {
      return AuthorizationResponse.deny("Impossible d'envoyer ce message à cet utilisateur.")
    }
    return true
  }
}

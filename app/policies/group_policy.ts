// AUTORISATIONS DES GROUPES (Bouncer)
// Les actions de gestion (ajouter, retirer, supprimer) sont réservées à l'administrateur du groupe.
// "membership" est la participation de l'utilisateur connecté au groupe, avec son rôle chargé
// (.preload('role')). Si la règle refuse, Bouncer lève une erreur 403 avec le message ci-dessous.

import { AuthorizationResponse, BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type UserConversation from '#models/user_conversation'
import { ADMIN_ROLE } from '#services/chat_service'

function estAdministrateur(membership: UserConversation) {
  return membership.role.title === ADMIN_ROLE
}

export default class GroupPolicy extends BasePolicy {
  ajouterMembres(_user: User, membership: UserConversation) {
    if (!estAdministrateur(membership)) {
      return AuthorizationResponse.deny("Seul l'administrateur du groupe peut ajouter des membres.")
    }
    return true
  }

  retirerMembres(_user: User, membership: UserConversation) {
    if (!estAdministrateur(membership)) {
      return AuthorizationResponse.deny("Seul l'administrateur du groupe peut retirer des membres.")
    }
    return true
  }

  // La personne visée par un retrait : un administrateur ne peut pas être retiré
  retirerCeMembre(_user: User, target: UserConversation) {
    if (estAdministrateur(target)) {
      return AuthorizationResponse.deny('Un administrateur ne peut pas être retiré.')
    }
    return true
  }

  supprimer(_user: User, membership: UserConversation) {
    if (!estAdministrateur(membership)) {
      return AuthorizationResponse.deny("Seul l'administrateur du groupe peut le supprimer.")
    }
    return true
  }
}

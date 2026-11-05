import { envoyer, lireErreur } from './message.js'
// ===== Page Groupes =====
// Ce fichier s'appuie sur messages.js (chargé avant) : envoyer(), lireErreur()...
// La liste des groupes, l'ouverture d'un groupe, l'envoi / modification / suppression
// de messages et le bouton Retour sont déjà gérés par messages.js.

// Ce fichier s'ajoute à message.js sur la page Groupes : il ne gère que la création, l'ajout et le retrait de membres, et la suppression.
let formulaireCreation = document.getElementById('group-create-form')
let modaleCreation = document.getElementById('group-create-modal')
let champNom = document.getElementById('group-name')
let compteur = document.getElementById('group-selected-count')
let boutonCreer = document.getElementById('group-create-submit')

const MEMBRES_MINIMUM = 2

// ===== 1. Petits outils =====

// Liste des identifiants cochés dans un conteneur (formulaire ou sélecteur)
function lireMembresCoches(conteneur) {
  let cases = conteneur.querySelectorAll('[data-member-checkbox]:checked')
  return Array.from(cases).map(function (caseCochee) {
    return caseCochee.value
  })
}

// Met à jour le compteur et active le bouton "Créer" seulement si tout est valide
function mettreAJourFormulaireCreation() {
  let nombre = lireMembresCoches(formulaireCreation).length

  compteur.textContent = nombre + ' sélectionné' + (nombre > 1 ? 's' : '') + ' · minimum ' + MEMBRES_MINIMUM

  let nomValide = champNom.value.trim().length >= 2
  boutonCreer.disabled = !(nomValide && nombre >= MEMBRES_MINIMUM)
}

// Recherche des personnes selon le nom tapé : c'est le SERVEUR qui cherche (au plus 20 résultats),
// la page ne reçoit jamais la liste de tous les utilisateurs.
// Les personnes déjà cochées restent dans la liste, même si elles ne correspondent plus au texte.
let minuteursRecherche = new WeakMap()

function filtrerMembres(champFiltre) {
  clearTimeout(minuteursRecherche.get(champFiltre))
  // On attend que la personne ait fini de taper (250 ms) avant d'interroger le serveur
  minuteursRecherche.set(champFiltre, setTimeout(function () { rechercherMembres(champFiltre) }, 250))
}

async function rechercherMembres(champFiltre) {
  let selecteur = champFiltre.closest('[data-member-picker]')
  let liste = selecteur.querySelector('[data-member-list]')
  let adresse = new URL(selecteur.dataset.searchUrl, window.location.origin)
  adresse.searchParams.set('q', champFiltre.value.trim())

  let reponse
  try {
    reponse = await fetch(adresse, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  } catch (erreurReseau) {
    kcNotifier.erreur('Impossible de contacter le serveur. Vérifiez votre connexion.')
    return
  }
  if (!reponse.ok) { return }

  // 1. On garde les personnes cochées, on retire les autres
  liste.querySelectorAll('[data-member-item]').forEach(function (element) {
    if (!element.querySelector('[data-member-checkbox]').checked) { element.remove() }
  })

  // 2. On ajoute les résultats qui ne sont pas déjà dans la liste
  let modele = document.createElement('template')
  modele.innerHTML = await reponse.text()
  modele.content.querySelectorAll('[data-member-item]').forEach(function (element) {
    if (liste.querySelector('[data-member-id="' + element.dataset.memberId + '"]') === null) {
      liste.appendChild(element)
    }
  })

  let aucun = liste.querySelectorAll('[data-member-item]').length === 0
  selecteur.querySelector('[data-member-empty]').classList.toggle('hidden', !aucun)
}

// Ferme une fenêtre et annule ce qui y était saisi
function fermerFenetre(fenetre) {
  let formulaire = fenetre.querySelector('form')
  if (formulaire !== null) { formulaire.reset() }

  fenetre.querySelectorAll('[data-member-filter]').forEach(function (champFiltre) {
    filtrerMembres(champFiltre)
  })

  fenetre.close()
  mettreAJourFormulaireCreation()
}

// ===== 2. Créer un groupe =====

async function creerGroupe() {
  let nom = champNom.value.trim()
  let membres = lireMembresCoches(formulaireCreation)

  if (nom.length < 2) {
    kcNotifier.erreur('Donnez un nom au groupe (2 caractères minimum).')
    return
  }
  if (membres.length < MEMBRES_MINIMUM) {
    kcNotifier.erreur('Sélectionnez au moins deux membres pour créer un groupe.')
    return
  }

  boutonCreer.disabled = true

  let resultat = await envoyer('/groups', 'POST', { name: nom, member_ids: membres })

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    mettreAJourFormulaireCreation()
    return
  }

  // Le groupe est créé : on l'ouvre (le message de réussite s'affichera sur cette page)
  window.location.href = '/groups/' + resultat.corps.id
}

// ===== 3. Ajouter des membres à un groupe =====

async function ajouterMembres(formulaire) {
  let membres = lireMembresCoches(formulaire)

  if (membres.length === 0) {
    kcNotifier.erreur('Sélectionnez au moins un utilisateur à ajouter.')
    return
  }

  let bouton = formulaire.querySelector('[type="submit"]')
  bouton.disabled = true

  let resultat = await envoyer(formulaire.getAttribute('action'), 'POST', { member_ids: membres })

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    bouton.disabled = false
    return
  }

  // On recharge la page : la liste des membres est mise à jour et le message de réussite s'affiche
  window.location.reload()
}
// ===== Supprimer un groupe (administrateur) =====

async function supprimerGroupe(bouton) {
  let nom = bouton.dataset.groupName

  let confirme = confirm(
    'Supprimer définitivement le groupe « ' + nom + ' » ?\n\n' +
    'Tous ses messages et ses fichiers seront effacés pour tous les membres. Cette action est irréversible.'
  )
  if (!confirme) { return }

  bouton.disabled = true

  let resultat = await envoyer('/groups/' + bouton.dataset.groupId, 'DELETE')

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    bouton.disabled = false
    return
  }

  // Le groupe n'existe plus : on retourne à la liste (le message de réussite s'y affichera)
  window.location.href = '/groups'
}
// ===== Retirer un membre (administrateur) =====

async function retirerMembre(bouton) {
  let confirme = confirm(
    'Retirer « ' + bouton.dataset.memberName + ' » du groupe ?\n\n' +
    'Cette personne ne pourra plus lire ni écrire dans le groupe.'
  )
  if (!confirme) { return }

  bouton.disabled = true

  let resultat = await envoyer(bouton.dataset.url, 'DELETE')

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    bouton.disabled = false
    return
  }

  // On recharge : la liste des membres est à jour et le message de réussite s'affiche
  window.location.reload()
}
// ===== 4. Événements (délégation : fonctionne aussi pour les panneaux chargés après coup) =====

// Au chargement : le bouton "Créer" est désactivé tant que le formulaire n'est pas valide
mettreAJourFormulaireCreation()

document.addEventListener('click', function (evenement) {
  let cible = evenement.target

  // Icône de création de groupe
  if (cible.closest('[data-open-group-create]') !== null) {
    modaleCreation.showModal()
    champNom.focus()
    return
  }

  // Icône d'informations du groupe
  if (cible.closest('[data-group-info-open]') !== null) {
    document.getElementById('group-info-modal').showModal()
    return
  }
  // Bouton "Supprimer le groupe"
  let boutonSupprimerGroupe = cible.closest('[data-delete-group]')
  if (boutonSupprimerGroupe !== null) {
    supprimerGroupe(boutonSupprimerGroupe)
    return
  }
  // Bouton "Retirer" d'un membre
  let boutonRetirer = cible.closest('[data-remove-member]')
  if (boutonRetirer !== null) {
    retirerMembre(boutonRetirer)
    return
  }
  // Boutons "Fermer" / "Annuler" de n'importe quelle fenêtre
  let boutonFermer = cible.closest('[data-modal-close]')
  if (boutonFermer !== null) {
    fermerFenetre(boutonFermer.closest('dialog'))
    return
  }

  // Clic sur le fond sombre (en dehors de la carte)
  if (cible.tagName === 'DIALOG') {
    fermerFenetre(cible)
  }
})

document.addEventListener('input', function (evenement) {
  let champFiltre = evenement.target.closest('[data-member-filter]')

  if (champFiltre !== null) {
    filtrerMembres(champFiltre)
    return
  }

  if (evenement.target === champNom) {
    mettreAJourFormulaireCreation()
  }
})

document.addEventListener('change', function (evenement) {
  if (evenement.target.matches('[data-member-checkbox]') && formulaireCreation.contains(evenement.target)) {
    mettreAJourFormulaireCreation()
  }
})

document.addEventListener('submit', async function (evenement) {
  let formulaire = evenement.target

  if (formulaire.id === 'group-create-form') {
    evenement.preventDefault()
    await creerGroupe()
    return
  }

  if (formulaire.matches('[data-add-members-form]')) {
    evenement.preventDefault()
    await ajouterMembres(formulaire)
  }
})
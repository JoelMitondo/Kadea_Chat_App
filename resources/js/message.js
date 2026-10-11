// ===== Messagerie Kadea Chat =====

// La messagerie fait beaucoup de requêtes : pas de chargeur plein écran pour elles
document.body.dataset.loaderFetch = 'off'

let page = document.getElementById('messages-page')
let panneau = document.getElementById('chat-pane')
let liste = document.getElementById('conversations-list')
let listeVide = document.getElementById('empty-list')
let modeleAccueil = document.getElementById('chat-placeholder')
let jeton = document.getElementById('csrf-token').value

// ===== 1. Petits outils =====

// Envoie une requête JSON au serveur et renvoie { ok, corps }
async function envoyer(adresse, methode, donnees) {
  let options = {
    method: methode,
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': jeton },
  }

  if (donnees !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(donnees)
  }

  try {
    let reponse = await fetch(adresse, options)
    let corps = {}
    try {
      corps = await reponse.json()
    } catch (erreurLecture) {
      corps = {}
    }
    return { ok: reponse.ok, corps: corps }
  } catch (erreurReseau) {
    return { ok: false, corps: { message: 'Impossible de contacter le serveur. Vérifiez votre connexion.' } }
  }
}

// Cherche le message d'erreur dans la réponse du serveur
function lireErreur(corps) {
  if (corps.errors && corps.errors.length > 0 && corps.errors[0].message) {
    return corps.errors[0].message
  }
  return corps.message || 'Une erreur est survenue. Veuillez réessayer.'
}

function defilerEnBas() {
  let zone = document.getElementById('messages-list')
  if (zone !== null) {
    zone.scrollTop = zone.scrollHeight
  }
}

// ===== 2. Liste des conversations =====

// Met en surbrillance la conversation ouverte (id = null : aucune)
function marquerActive(id) {
  let elements = liste.querySelectorAll('[data-conversation-item]')

  elements.forEach(function (element) {
    let estActive = id !== null && element.dataset.conversationId === String(id)
    element.dataset.active = estActive ? 'true' : 'false'

    // La conversation est ouverte : ses messages sont lus, on cache le compteur
    if (estActive) {
      element.querySelector('[data-unread-badge]').classList.add('hidden')
    }
  })

  page.dataset.activeId = id === null ? '' : String(id)
}

// Met à jour l'aperçu et l'heure d'une conversation, puis la remonte en haut de la liste
function mettreAJourListe(idConversation, apercu, heure) {
  let element = liste.querySelector('[data-conversation-item][data-conversation-id="' + idConversation + '"]')
  if (element === null) { return }

  element.querySelector('[data-preview]').textContent = apercu
  element.querySelector('[data-time]').textContent = heure
  liste.prepend(element)
}

function verifierListeVide() {
  let aucuneConversation = liste.querySelectorAll('[data-conversation-item]').length === 0
  listeVide.classList.toggle('hidden', !aucuneConversation)
}

// ===== 3. Ouvrir et fermer une discussion =====

// Charge le panneau de discussion depuis le serveur. Renvoie true si tout s'est bien passé.
async function ouvrirConversation(id) {
  let reponse
  try {
    reponse = await fetch('/conversations/' + id, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  } catch (erreurReseau) {
    kcNotifier.erreur('Impossible de contacter le serveur. Vérifiez votre connexion.')
    return false
  }

  if (!reponse.ok) {
    kcNotifier.erreur("Impossible d'ouvrir cette conversation.")
    return false
  }

  panneau.innerHTML = await reponse.text()
  marquerActive(id)
  page.dataset.view = 'chat' // sur téléphone : la liste disparaît
  defilerEnBas()
  return true
}

// Revient à l'écran d'accueil (sur téléphone : on réaffiche la liste)
function fermerChat() {
  panneau.innerHTML = modeleAccueil.innerHTML
  page.dataset.view = 'list'
  marquerActive(null)
}

// ===== 4. Historique du navigateur (bouton Retour du téléphone) =====

// Règle : l'historique contient toujours [liste, discussion].
// Si une discussion est déjà ouverte, on remplace l'entrée au lieu d'en ajouter une.
function memoriserDansHistorique(id) {
  let etat = { vue: 'chat', id: id }
  let adresse = '/conversations/' + id

  if (history.state !== null && history.state.vue === 'chat') {
    history.replaceState(etat, '', adresse)
  } else {
    history.pushState(etat, '', adresse)
  }
}

// Au chargement de la page
if (page.dataset.view === 'chat') {
  // Page ouverte directement sur une discussion : on fabrique l'entrée "liste" juste avant
  let idOuvert = page.dataset.activeId
  history.replaceState({ vue: 'liste' }, '', '/messages')
  history.pushState({ vue: 'chat', id: idOuvert }, '', '/conversations/' + idOuvert)
  defilerEnBas()
} else {
  history.replaceState({ vue: 'liste' }, '', '/messages')
}

// Bouton Retour du téléphone ou du navigateur
window.addEventListener('popstate', function (evenement) {
  let etat = evenement.state

  if (etat !== null && etat.vue === 'chat') {
    ouvrirConversation(etat.id)
  } else {
    fermerChat()
  }
})

// ===== 5. Envoyer ou modifier un message =====

function entrerModeEdition(idMessage) {
  let bulle = document.querySelector('[data-message-id="' + idMessage + '"]')
  let formulaire = document.getElementById('composer')
  if (bulle === null || formulaire === null) { return }

  let champ = formulaire.querySelector('[name="content"]')
  champ.value = bulle.querySelector('[data-message-text]').textContent.trim()

  formulaire.dataset.editingId = idMessage
  document.getElementById('edit-banner').classList.remove('hidden')
  document.getElementById('edit-banner').classList.add('flex')
  champ.focus()
}

function quitterModeEdition() {
  let formulaire = document.getElementById('composer')
  if (formulaire === null) { return }

  delete formulaire.dataset.editingId
  formulaire.querySelector('[name="content"]').value = ''
  document.getElementById('edit-banner').classList.add('hidden')
  document.getElementById('edit-banner').classList.remove('flex')
}

document.addEventListener('submit', async function (evenement) {
  let formulaire = evenement.target
  if (formulaire.id !== 'composer') { return }

  evenement.preventDefault()

  let champ = formulaire.querySelector('[name="content"]')
  let bouton = formulaire.querySelector('[type="submit"]')
  let contenu = champ.value.trim()
  if (contenu === '') { return }

  let idEdition = formulaire.dataset.editingId
  let idConversation = document.getElementById('chat-panel').dataset.conversationId

  bouton.disabled = true

  let resultat
  if (idEdition) {
    resultat = await envoyer('/messages/' + idEdition, 'PUT', { content: contenu })
  } else {
    resultat = await envoyer(formulaire.getAttribute('action'), 'POST', { content: contenu })
  }

  bouton.disabled = false

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    return
  }

  if (idEdition) {
    // On remplace l'ancienne bulle par la nouvelle
    let ancienne = document.querySelector('[data-message-id="' + idEdition + '"]')
    ancienne.outerHTML = resultat.corps.html
    quitterModeEdition()
  } else {
    document.getElementById('messages-list').insertAdjacentHTML('beforeend', resultat.corps.html)
    champ.value = ''
    defilerEnBas()
  }

  if (resultat.corps.isLast) {
    mettreAJourListe(idConversation, resultat.corps.preview, resultat.corps.time)
  }
  champ.focus()
})

// ===== 6. Supprimer un message / une conversation =====

async function supprimerMessage(idMessage) {
  if (!confirm('Supprimer ce message ?')) { return }

  let resultat = await envoyer('/messages/' + idMessage, 'DELETE')
  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    return
  }

  let bulle = document.querySelector('[data-message-id="' + idMessage + '"]')
  bulle.outerHTML = resultat.corps.html
  quitterModeEdition()

  if (resultat.corps.isLast) {
    let idConversation = document.getElementById('chat-panel').dataset.conversationId
    mettreAJourListe(idConversation, resultat.corps.preview, resultat.corps.time)
  }
}

async function supprimerConversation(element) {
  let id = element.dataset.conversationId

  if (!confirm('Supprimer cette conversation ? Elle disparaîtra de votre liste.')) { return }

  let resultat = await envoyer('/conversations/' + id, 'DELETE')
  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    return
  }

  let etaitOuverte = page.dataset.activeId === id
  element.remove()
  verifierListeVide()
  kcNotifier.succes(resultat.corps.message)

  if (etaitOuverte) {
    // Si l'historique contient notre entrée "discussion", on revient en arrière (popstate ferme le chat)
    if (history.state !== null && history.state.vue === 'chat') {
      history.back()
    } else {
      fermerChat()
    }
  }
}

// ===== 7. Tous les clics (délégation : fonctionne aussi pour le contenu ajouté après coup) =====

document.addEventListener('click', async function (evenement) {
  let cible = evenement.target

  // Clic sur une conversation de la liste
  let lien = cible.closest('[data-conversation-link]')
  if (lien !== null) {
    evenement.preventDefault()
    let id = lien.dataset.conversationId
    let reussi = await ouvrirConversation(id)
    if (reussi) { memoriserDansHistorique(id) }
    return
  }

  // Bouton "Retour" (mobile)
  if (cible.closest('[data-chat-back]') !== null) {
    history.back()
    return
  }

  // Corbeille d'une conversation
  let boutonConversation = cible.closest('[data-delete-conversation]')
  if (boutonConversation !== null) {
    supprimerConversation(boutonConversation.closest('[data-conversation-item]'))
    return
  }

  // Modifier / supprimer un message
  let boutonModifier = cible.closest('[data-edit-message]')
  if (boutonModifier !== null) {
    entrerModeEdition(boutonModifier.closest('[data-message-id]').dataset.messageId)
    return
  }

  let boutonSupprimer = cible.closest('[data-delete-message]')
  if (boutonSupprimer !== null) {
    supprimerMessage(boutonSupprimer.closest('[data-message-id]').dataset.messageId)
    return
  }

  // Annuler la modification
  if (cible.closest('[data-cancel-edit]') !== null) {
    quitterModeEdition()
  }
})
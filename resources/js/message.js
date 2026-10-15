// ===== Messagerie Kadea Chat =====

// La messagerie fait beaucoup de requêtes : pas de chargeur plein écran pour elles
document.body.dataset.loaderFetch = 'off'

let page = document.getElementById('messages-page')
let panneau = document.getElementById('chat-pane')
let liste = document.getElementById('conversations-list')
let listeVide = document.getElementById('empty-list')
let modeleAccueil = document.getElementById('chat-placeholder')
let jeton = document.getElementById('csrf-token').value
// Adresses utilisées : elles changent selon la page (Messages ou Groupes)
let adresseListe = page.dataset.listUrl // "/messages" ou "/groups"
let adresseChat = page.dataset.chatUrl // "/conversations" ou "/groups"

// ===== 1. Petits outils =====

// Envoie une requête JSON au serveur et renvoie { ok, corps }
export async function envoyer(adresse, methode, donnees) {
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
    reponse = await fetch(adresseChat+ '/' + + id, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  } catch (erreurReseau) {
    kcNotifier.erreur('Impossible de contacter le serveur. Vérifiez votre connexion.')
    return false
  }

  if (!reponse.ok) {
    kcNotifier.erreur("Impossible d'ouvrir cette conversation.")
    return false
  }

  panneau.innerHTML = await reponse.text()
    fichierJoint = null // un fichier choisi dans l'ancienne conversation est oublié
  marquerActive(id)
  page.dataset.view = 'chat' // sur téléphone : la liste disparaît
  defilerEnBas()

  // On vient de lire les messages de cette conversation : les pastilles de la navigation changent
  document.dispatchEvent(new CustomEvent('kc:rafraichir-compteurs'))
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
  let adresse = adresseChat + '/' + id

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
  history.replaceState({ vue: 'liste' }, '', adresseListe)
  history.pushState({ vue: 'chat', id: idOuvert }, '', adresseChat + '/' + idOuvert)
  defilerEnBas()
} else {
  history.replaceState({ vue: 'liste' }, '', adresseListe)
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

// Fichier (image ou document) choisi avec le trombone, pas encore envoyé
let fichierJoint = null

const EXTENSIONS_ACCEPTEES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']
const TAILLE_MAX_FICHIER = 10 * 1024 * 1024 // 10 Mo

// Vérifie le fichier choisi (type et taille), puis l'affiche au-dessus du champ de saisie
function choisirFichier(fichier) {
  let extension = fichier.name.split('.').pop().toLowerCase()

  if (EXTENSIONS_ACCEPTEES.indexOf(extension) === -1) {
    kcNotifier.erreur('Type de fichier non accepté. Images : JPG, PNG, GIF, WebP. Documents : PDF, Word, Excel, PowerPoint, TXT, CSV.')
    retirerFichierJoint()
    return
  }

  if (fichier.size > TAILLE_MAX_FICHIER) {
    kcNotifier.erreur('Le fichier est trop lourd : 10 Mo maximum.')
    retirerFichierJoint()
    return
  }

  fichierJoint = fichier
  document.getElementById('attachment-name').textContent = fichier.name
  document.getElementById('attachment-chip').classList.remove('hidden')
  document.getElementById('attachment-chip').classList.add('flex')
}

// Annule le fichier choisi
function retirerFichierJoint() {
  fichierJoint = null

  let champ = document.getElementById('attachment-input')
  let bandeau = document.getElementById('attachment-chip')

  if (champ !== null) { champ.value = '' }
  if (bandeau !== null) {
    bandeau.classList.add('hidden')
    bandeau.classList.remove('flex')
  }
}

// Envoie un message AVEC un fichier. Un fichier ne peut pas passer en JSON :
// on utilise un "FormData" (un formulaire construit à la main).
async function envoyerFichier(adresse, contenu, fichier) {
  let donnees = new FormData()
  donnees.append('content', contenu)
  donnees.append('attachment', fichier)

  try {
    let reponse = await fetch(adresse, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': jeton },
      body: donnees,
    })

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

function entrerModeEdition(idMessage) {
  let bulle = document.querySelector('[data-message-id="' + idMessage + '"]')
  let formulaire = document.getElementById('composer')
  if (bulle === null || formulaire === null) { return }

  // Un message qui n'a pas de texte ne peut pas être modifié
  let zoneTexte = bulle.querySelector('[data-message-text]')
  if (zoneTexte === null) { return }

  retirerFichierJoint() // on ne peut pas ajouter un fichier en modifiant un message

  let champ = formulaire.querySelector('[name="content"]')
  champ.value = zoneTexte.textContent.trim()

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

// Un fichier est choisi avec le trombone
document.addEventListener('change', function (evenement) {
  if (evenement.target.id !== 'attachment-input') { return }

  let fichier = evenement.target.files[0]
  if (fichier !== undefined) {
    choisirFichier(fichier)
  }
})

// Envoi du formulaire de saisie
document.addEventListener('submit', async function (evenement) {
  let formulaire = evenement.target
  if (formulaire.id !== 'composer') { return }

  evenement.preventDefault()

  let champ = formulaire.querySelector('[name="content"]')
  let bouton = formulaire.querySelector('[type="submit"]')
  let contenu = champ.value.trim()
  let idEdition = formulaire.dataset.editingId

  // Rien à envoyer : en modification il faut du texte ; sinon il faut un texte OU un fichier
  if (contenu === '' && (idEdition || fichierJoint === null)) { return }

  let idConversation = document.getElementById('chat-panel').dataset.conversationId

  bouton.disabled = true

  let resultat
  if (idEdition) {
    resultat = await envoyer('/messages/' + idEdition, 'PUT', { content: contenu })
  } else if (fichierJoint !== null) {
    resultat = await envoyerFichier(formulaire.getAttribute('action'), contenu, fichierJoint)
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
    retirerMessageVide()
    document.getElementById('messages-list').insertAdjacentHTML('beforeend', resultat.corps.html)
    champ.value = ''
    retirerFichierJoint()
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

  let resultat = await envoyer(adresseChat + '/' + id, 'DELETE')
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

// Bloque (bloquer = true) ou débloque (bloquer = false) l'interlocuteur
async function changerBlocage(idUtilisateur, bloquer) {
  let question = bloquer
    ? 'Bloquer cet utilisateur ? Il ne pourra plus vous envoyer de nouveaux messages.'
    : 'Débloquer cet utilisateur ?'

  if (!confirm(question)) { return }

  let adresse = '/users/' + idUtilisateur + (bloquer ? '/block' : '/unblock')
  let resultat = await envoyer(adresse, 'POST')

  if (!resultat.ok) {
    kcNotifier.erreur(lireErreur(resultat.corps))
    return
  }

  kcNotifier.succes(resultat.corps.message)

  // On recharge la conversation pour afficher le bandeau et le bon bouton
  ouvrirConversation(page.dataset.activeId)
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
  // Bloquer / débloquer l'interlocuteur
  let boutonBloquer = cible.closest('[data-block-user]')
  if (boutonBloquer !== null) {
    changerBlocage(boutonBloquer.dataset.userId, true)
    return
  }

  let boutonDebloquer = cible.closest('[data-unblock-user]')
  if (boutonDebloquer !== null) {
    changerBlocage(boutonDebloquer.dataset.userId, false)
    return
  }
    // Trombone : ouvre le choix de fichier
  if (cible.closest('[data-pick-attachment]') !== null) {
    document.getElementById('attachment-input').click()
    return
  }

  // Croix à côté du nom du fichier : on annule le fichier
  if (cible.closest('[data-remove-attachment]') !== null) {
    retirerFichierJoint()
    return
  }
  // Annuler la modification
  if (cible.closest('[data-cancel-edit]') !== null) {
    quitterModeEdition()
  }
})

// ===== 8. TEMPS RÉEL =====
// realtime.js (chargé dans le layout) reçoit les événements du serveur et nous les transmet
// sous la forme d'un événement du navigateur nommé "kc:evenement".
// Ici, on met à jour la LISTE et la DISCUSSION de cette page.

function trouverElementListe(idConversation) {
  return liste.querySelector('[data-conversation-item][data-conversation-id="' + idConversation + '"]')
}

// Ajoute une ligne (déjà fabriquée par le serveur) en haut de la liste
function ajouterElementListe(html) {
  liste.insertAdjacentHTML('afterbegin', html)
  listeVide.classList.add('hidden')
}

// Compteur de messages non lus d'une conversation : +1
function incrementerBadge(idConversation) {
  let element = trouverElementListe(idConversation)
  if (element === null) { return }

  let badge = element.querySelector('[data-unread-badge]')
  let nombre = parseInt(badge.textContent, 10)
  if (isNaN(nombre)) { nombre = 0 }

  badge.textContent = String(nombre + 1)
  badge.classList.remove('hidden')
}

// Retire le texte "Aucun message" quand le premier message arrive
function retirerMessageVide() {
  let avis = document.querySelector('[data-empty-notice]')
  if (avis !== null) { avis.remove() }
}

// Prévient le serveur que les messages de cette conversation ont été lus
async function signalerLecture(idConversation) {
  await envoyer('/conversations/' + idConversation + '/read', 'POST')
  document.dispatchEvent(new CustomEvent('kc:rafraichir-compteurs'))
}

// Un nouveau message vient d'être envoyé par quelqu'un d'autre
function traiterNouveauMessage(donnees) {
  let idConversation = String(donnees.conversationId)
  let estOuverte = page.dataset.activeId === idConversation

  // Déjà affiché (par exemple reçu deux fois) : on ne fait rien
  if (document.querySelector('[data-message-id="' + donnees.messageId + '"]') !== null) { return }

  // 1. La conversation n'est pas encore dans la liste (premier message...) : on l'ajoute
  if (trouverElementListe(idConversation) === null && donnees.itemHtml) {
    ajouterElementListe(donnees.itemHtml)
  }

  // 2. Aperçu et heure mis à jour, la conversation remonte en haut de la liste
  mettreAJourListe(idConversation, donnees.preview, donnees.time)

  if (estOuverte) {
    // 3a. On regarde cette conversation : la bulle s'ajoute sous nos yeux
    retirerMessageVide()
    document.getElementById('messages-list').insertAdjacentHTML('beforeend', donnees.html)
    defilerEnBas()

    // Si l'onglet est visible, le message est lu tout de suite (l'expéditeur voit les coches bleues).
    // Sinon, il sera marqué comme lu au retour sur l'onglet (voir plus bas).
    if (document.visibilityState === 'visible') {
      signalerLecture(idConversation)
    }
  } else {
    // 3b. Une autre conversation : son compteur de non lus augmente
    incrementerBadge(idConversation)
  }
}

// Un message a été modifié ou supprimé par son auteur
function traiterMessageModifie(donnees) {
  let bulle = document.querySelector('[data-message-id="' + donnees.messageId + '"]')
  if (bulle !== null) {
    bulle.outerHTML = donnees.html
  }

  // C'était le dernier message : l'aperçu de la liste change aussi
  if (donnees.isLast) {
    mettreAJourListe(donnees.conversationId, donnees.preview, donnees.time)
  }
}

// Quelqu'un a lu nos messages : leurs coches passent en bleu
function traiterLecture(donnees) {
  donnees.messageIds.forEach(function (idMessage) {
    let bulle = document.querySelector('[data-message-id="' + idMessage + '"]')
    if (bulle === null) { return }

    let cocheEnvoye = bulle.querySelector('[data-tick-sent]')
    let cocheLu = bulle.querySelector('[data-tick-read]')
    if (cocheEnvoye !== null) { cocheEnvoye.classList.add('hidden') }
    if (cocheLu !== null) { cocheLu.classList.remove('hidden') }
  })
}

// Un groupe a changé (nouveaux membres) : si on le regarde, on recharge son panneau
function traiterGroupeModifie(donnees) {
  if (page.dataset.activeId !== String(donnees.conversationId)) { return }

  // On ne recharge pas si la fenêtre d'infos est ouverte ou si un message est en cours d'écriture
  let fenetreInfos = document.getElementById('group-info-modal')
  let champ = document.querySelector('#composer [name="content"]')
  let fenetreOuverte = fenetreInfos !== null && fenetreInfos.open
  let messageEnCours = champ !== null && champ.value !== ''

  if (!fenetreOuverte && !messageEnCours) {
    ouvrirConversation(donnees.conversationId)
  }
}

// Point d'entrée : tous les événements du serveur passent par ici
document.addEventListener('kc:evenement', function (evenement) {
  let donnees = evenement.detail

  // Cette page ne s'occupe que de son type de conversation (privée ou groupe).
  // Les événements sans "kind" (comme la lecture ou la présence) passent.
  if (donnees.kind !== undefined && donnees.kind !== page.dataset.kind) { return }

  if (donnees.type === 'message:new') { traiterNouveauMessage(donnees) }
  if (donnees.type === 'message:updated') { traiterMessageModifie(donnees) }
  if (donnees.type === 'messages:read') { traiterLecture(donnees) }
  if (donnees.type === 'group:updated') { traiterGroupeModifie(donnees) }

  if (donnees.type === 'conversation:added' && trouverElementListe(donnees.conversationId) === null) {
    ajouterElementListe(donnees.itemHtml)
  }
})

// Retour sur l'onglet : les messages reçus pendant son absence sont maintenant lus
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && page.dataset.activeId !== '') {
    signalerLecture(page.dataset.activeId)
  }
})

// Connexion rétablie après une coupure : on a pu rater des messages, on recharge la page
// (sauf si un message est en cours d'écriture, pour ne pas le perdre)
document.addEventListener('kc:reconnecte', function () {
  let champ = document.querySelector('#composer [name="content"]')
  if (champ === null || champ.value === '') {
    window.location.reload()
  }
})
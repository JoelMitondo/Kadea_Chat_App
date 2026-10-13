// ===== Page Stories =====
//
// Ce fichier s'occupe de quatre choses :
//   1. la fenêtre "Ajouter une story" (aperçu de l'image et vérification) ;
//   2. la visionneuse : la vraie image n'est téléchargée QU'AU CLIC ;
//   3. les textes "Expire dans..." qui se mettent à jour, et les stories expirées qui disparaissent ;
//   4. le rafraîchissement de la liste quand quelqu'un publie.

let flux = document.getElementById('stories-feed')

// Fenêtre d'ajout
let modaleAjout = document.getElementById('story-add-modal')
let formulaireAjout = modaleAjout.querySelector('form')
let champImage = document.getElementById('story-image')
let apercuAjout = document.getElementById('story-preview')
let texteApercu = document.getElementById('story-preview-placeholder')

// Visionneuse
let visionneuse = document.getElementById('story-viewer')
let imageFlou = document.getElementById('story-viewer-blur')
let imageNette = document.getElementById('story-viewer-image')
let zoneChargement = document.getElementById('story-viewer-loading')
let zoneErreur = document.getElementById('story-viewer-error')
let boutonPrecedent = visionneuse.querySelector('[data-story-prev]')
let boutonSuivant = visionneuse.querySelector('[data-story-next]')
let imageAvatar = document.getElementById('story-viewer-avatar')

const TAILLE_MAX = 8 * 1024 * 1024 // 8 Mo
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp']

// ===== 1. Fenêtre "Ajouter une story" =====

// Remet l'aperçu à zéro
function reinitialiserApercu() {
  apercuAjout.removeAttribute('src')
  apercuAjout.classList.add('hidden')
  texteApercu.classList.remove('hidden')
}

function fermerFenetreAjout() {
  formulaireAjout.reset()
  reinitialiserApercu()
  modaleAjout.close()
}

// Une image est choisie : on la vérifie, puis on l'affiche en aperçu
champImage.addEventListener('change', function () {
  let fichier = champImage.files[0]

  if (fichier === undefined) {
    reinitialiserApercu()
    return
  }

  if (TYPES_ACCEPTES.indexOf(fichier.type) === -1) {
    kcNotifier.erreur('Format non accepté. Choisissez une image JPG, PNG ou WebP.')
    champImage.value = ''
    reinitialiserApercu()
    return
  }

  if (fichier.size > TAILLE_MAX) {
    kcNotifier.erreur("L'image est trop lourde : 8 Mo maximum.")
    champImage.value = ''
    reinitialiserApercu()
    return
  }

  apercuAjout.src = URL.createObjectURL(fichier)
  apercuAjout.classList.remove('hidden')
  texteApercu.classList.add('hidden')
})

// ===== 2. Visionneuse =====

let histoires = [] // tous les aperçus de la page, dans l'ordre où ils sont affichés
let position = 0 // numéro de la story affichée dans la liste
let numeroChargement = 0 // sert à ignorer un téléchargement devenu inutile (si on passe vite à la suivante)

// Si la photo de l'auteur ne se charge pas, on la cache : ses initiales restent visibles
imageAvatar.addEventListener('error', function () {
  imageAvatar.classList.add('hidden')
})

function ouvrirVisionneuse(element) {
  // On repart de la liste actuelle des aperçus (elle peut avoir changé depuis la dernière fois)
  histoires = Array.from(document.querySelectorAll('[data-story]'))
  position = histoires.indexOf(element)

  visionneuse.showModal()
  afficherHistoire()
}

function afficherHistoire() {
  let element = histoires[position]

  numeroChargement = numeroChargement + 1
  let monNumero = numeroChargement

  // --- En-tête : auteur, heure, temps restant, compteur ---
  document.getElementById('story-viewer-author').textContent = element.dataset.authorName
  document.getElementById('story-viewer-initials').textContent = element.dataset.authorInitials
  document.getElementById('story-viewer-meta').textContent =
    element.dataset.posted + ' · expire dans ' + libelleTempsRestant(element.dataset.expiresAt)
  document.getElementById('story-viewer-counter').textContent = (position + 1) + ' / ' + histoires.length

  if (element.dataset.authorAvatar) {
    imageAvatar.src = element.dataset.authorAvatar
    imageAvatar.classList.remove('hidden')
  } else {
    imageAvatar.removeAttribute('src')
    imageAvatar.classList.add('hidden')
  }

  // --- Légende ---
  let legende = document.getElementById('story-viewer-caption')
  legende.textContent = element.dataset.caption
  legende.classList.toggle('hidden', element.dataset.caption === '')

  // --- Boutons précédent / suivant (cachés aux deux extrémités) ---
  boutonPrecedent.classList.toggle('invisible', position === 0)
  boutonSuivant.classList.toggle('invisible', position === histoires.length - 1)

  // --- L'image ---
  // 1. L'aperçu flou s'affiche immédiatement : il est déjà téléchargé (quelques Ko)
  imageFlou.src = element.dataset.blurUrl

  // 2. On cache l'ancienne image nette et on montre le chargement
  imageNette.classList.add('opacity-0')
  imageNette.removeAttribute('src')
  zoneChargement.classList.remove('hidden')
  zoneErreur.classList.add('hidden')
  zoneErreur.classList.remove('flex')

  // 3. SEULEMENT MAINTENANT, le téléchargement de la version nette commence
  imageNette.onload = function () {
    if (monNumero !== numeroChargement) { return } // on est déjà passé à une autre story
    zoneChargement.classList.add('hidden')
    imageNette.classList.remove('opacity-0')
  }

  imageNette.onerror = function () {
    if (monNumero !== numeroChargement) { return }
    zoneChargement.classList.add('hidden')
    zoneErreur.classList.remove('hidden')
    zoneErreur.classList.add('flex')
  }

  imageNette.src = element.dataset.fullUrl
}

function storySuivante() {
  if (position < histoires.length - 1) {
    position = position + 1
    afficherHistoire()
  }
}

function storyPrecedente() {
  if (position > 0) {
    position = position - 1
    afficherHistoire()
  }
}

// Flèches du clavier (Échap ferme la fenêtre sans qu'on ait rien à faire)
document.addEventListener('keydown', function (evenement) {
  if (!visionneuse.open) { return }
  if (evenement.key === 'ArrowRight') { storySuivante() }
  if (evenement.key === 'ArrowLeft') { storyPrecedente() }
})

// ===== 3. Temps restant et expiration =====

// Même règle que formatTimeLeft() côté serveur
function libelleTempsRestant(dateExpiration) {
  let minutes = Math.ceil((Date.parse(dateExpiration) - Date.now()) / 60000)

  if (minutes <= 0) { return 'expirée' }
  if (minutes < 60) { return minutes + ' min' }

  let heures = Math.floor(minutes / 60)
  let reste = minutes % 60
  return reste === 0 ? heures + ' h' : heures + ' h ' + reste + ' min'
}

// Toutes les 30 secondes : on met à jour les textes, et si une story a expiré on recharge la liste
function mettreAJourTemps() {
  let nombreExpirees = 0

  document.querySelectorAll('[data-story]').forEach(function (element) {
    if (Date.parse(element.dataset.expiresAt) <= Date.now()) {
      nombreExpirees = nombreExpirees + 1
      return
    }

    let etiquette = element.querySelector('[data-time-left]')
    if (etiquette !== null) {
      etiquette.textContent = 'Expire dans ' + libelleTempsRestant(element.dataset.expiresAt)
    }
  })

  if (nombreExpirees > 0) {
    rafraichirFlux()
  }
}

setInterval(mettreAJourTemps, 30000)

// ===== 4. Rafraîchir la liste =====

let rafraichissementEnAttente = false

async function rafraichirFlux() {
  // On ne remplace pas la page pendant qu'on regarde une story ou qu'on remplit le formulaire :
  // on le fera dès que la fenêtre se ferme.
  if (visionneuse.open || modaleAjout.open) {
    rafraichissementEnAttente = true
    return
  }

  rafraichissementEnAttente = false

  try {
    // noLoader : pas de chargeur plein écran pour cette petite requête (voir loader.js)
    let reponse = await fetch('/stories', {
      noLoader: true,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!reponse.ok) { return }

    flux.innerHTML = await reponse.text()
  } catch (erreurReseau) {
    // Pas de connexion : on réessaiera au prochain événement
  }
}

visionneuse.addEventListener('close', function () {
  if (rafraichissementEnAttente) { rafraichirFlux() }
})

modaleAjout.addEventListener('close', function () {
  if (rafraichissementEnAttente) { rafraichirFlux() }
})

// Temps réel : realtime.js nous transmet les événements du serveur (voir le message sur le temps réel)
document.addEventListener('kc:evenement', function (evenement) {
  if (evenement.detail.type === 'story:new') {
    rafraichirFlux()
  }
})

// Connexion rétablie après une coupure : on a pu rater une story
document.addEventListener('kc:reconnecte', rafraichirFlux)

// ===== 5. Tous les clics (délégation : fonctionne aussi pour la liste rechargée) =====

document.addEventListener('click', function (evenement) {
  let cible = evenement.target

  // Clic sur une story : on ouvre la visionneuse (c'est ici que commence le téléchargement)
  let story = cible.closest('[data-story]')
  if (story !== null) {
    ouvrirVisionneuse(story)
    return
  }

  // Bouton "Ajouter une story"
  if (cible.closest('[data-open-story-add]') !== null) {
    modaleAjout.showModal()
    return
  }

  // Boutons "Fermer" / "Annuler" de la fenêtre d'ajout
  if (cible.closest('#story-add-modal [data-modal-close]') !== null) {
    fermerFenetreAjout()
    return
  }

  // Clic sur le fond sombre de la fenêtre d'ajout
  if (cible === modaleAjout) {
    fermerFenetreAjout()
    return
  }

  // Visionneuse : fermer, précédente, suivante
  if (cible.closest('[data-story-close]') !== null) {
    visionneuse.close()
    return
  }
  if (cible.closest('[data-story-prev]') !== null) {
    storyPrecedente()
    return
  }
  if (cible.closest('[data-story-next]') !== null) {
    storySuivante()
  }
})
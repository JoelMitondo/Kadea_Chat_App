// ===== Chargeur Kadea Chat =====

var chargeur = document.getElementById('kc-loader')
var nombreRequetesEnCours = 0
var minuteurRequete = null

// ----- Afficher et cacher le chargeur -----

function afficherChargeur() {
  if (chargeur === null) { return }
  chargeur.classList.remove('opacity-0', 'invisible')
}

function masquerChargeur() {
  if (chargeur === null) { return }
  chargeur.classList.add('opacity-0', 'invisible')
}

// On rend ces deux fonctions utilisables partout : kcLoader.afficher() et kcLoader.masquer()
window.kcLoader = {
  afficher: afficherChargeur,
  masquer: masquerChargeur,
}

// ----- 1. Chargement de la page -----
// Le chargeur est visible au départ, on le cache quand la page est entièrement chargée.
window.addEventListener('load', masquerChargeur)

// Cas du bouton "Retour" du navigateur : la page revient de la mémoire
// et le chargeur pourrait rester affiché par erreur.
window.addEventListener('pageshow', function (evenement) {
  if (evenement.persisted) {
    masquerChargeur()
  }
})

// ----- 2. Envoi d'un formulaire -----
document.addEventListener('submit', function (evenement) {
  // Un autre script a annulé l'envoi : on ne fait rien
  if (evenement.defaultPrevented) { return }

  // Pour ignorer un formulaire, on lui ajoute l'attribut data-no-loader
  if (evenement.target.hasAttribute('data-no-loader')) { return }

  afficherChargeur()
})

// ----- 3. Clic sur un lien vers une autre page du site -----
document.addEventListener('click', function (evenement) {
  var lien = evenement.target.closest('a')

  // Le clic n'est pas sur un lien
  if (lien === null) { return }

  // Cas où il ne faut PAS afficher le chargeur
  var annule = evenement.defaultPrevented
  var ouvreUnNouvelOnglet = lien.target === '_blank'
  var telechargeUnFichier = lien.hasAttribute('download')
  var ignoreParLeDeveloppeur = lien.hasAttribute('data-no-loader')
  var toucheSpeciale = evenement.ctrlKey || evenement.metaKey || evenement.shiftKey || evenement.button !== 0
  var autreSite = lien.origin !== window.location.origin
  var memePageAvecAncre =
    lien.pathname === window.location.pathname && lien.search === window.location.search && lien.hash !== ''

  if (annule || ouvreUnNouvelOnglet || telechargeUnFichier || ignoreParLeDeveloppeur) { return }
  if (toucheSpeciale || autreSite || memePageAvecAncre) { return }

  afficherChargeur()
})

// ----- 4. Requêtes vers le backend avec fetch -----
// On garde la vraie fonction fetch, puis on la remplace par une version
// qui affiche le chargeur pendant que la requête est en cours.
var fetchOriginal = window.fetch

window.fetch = function (adresse, options) {
  // Pour une requête précise sans chargeur : fetch(url, { noLoader: true })
  if (options && options.noLoader === true) {
    return fetchOriginal.apply(window, arguments)
  }

  // Sur une page où l'on ne veut jamais de chargeur pour fetch (ex. la messagerie) :
  // <body data-loader-fetch="off">
  if (document.body.dataset.loaderFetch === 'off') {
    return fetchOriginal.apply(window, arguments)
  }

  nombreRequetesEnCours = nombreRequetesEnCours + 1

  // On attend 250 ms avant d'afficher, pour éviter un clignotement sur les requêtes très rapides
  if (nombreRequetesEnCours === 1) {
    minuteurRequete = setTimeout(afficherChargeur, 250)
  }

  function requeteTerminee() {
    nombreRequetesEnCours = nombreRequetesEnCours - 1

    if (nombreRequetesEnCours === 0) {
      clearTimeout(minuteurRequete)
      masquerChargeur()
    }
  }

  // .finally s'exécute que la requête réussisse ou échoue
  return fetchOriginal.apply(window, arguments).finally(requeteTerminee)
}
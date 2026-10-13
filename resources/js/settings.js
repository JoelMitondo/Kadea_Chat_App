// ===== Page Paramètres =====

let fenetreMotDePasse = document.getElementById('password-dialog')
let boutonOuvrir = document.getElementById('open-password-dialog')
let boutonsFermer = fenetreMotDePasse.querySelectorAll('[data-modal-close]')

// Clic sur "Oui, modifier mon mot de passe" : on ouvre la question sur l'e-mail
boutonOuvrir.addEventListener('click', function () {
  fenetreMotDePasse.showModal()
})

// Clic sur "Non, annuler" : on ferme la fenêtre
boutonsFermer.forEach(function (bouton) {
  bouton.addEventListener('click', function () {
    fenetreMotDePasse.close()
  })
})

// Clic sur le fond sombre (en dehors de la carte) : on ferme aussi
fenetreMotDePasse.addEventListener('click', function (evenement) {
  if (evenement.target === fenetreMotDePasse) {
    fenetreMotDePasse.close()
  }
})
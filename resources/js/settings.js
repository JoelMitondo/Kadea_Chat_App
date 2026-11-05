// ===== Page Paramètres =====

// Relie un bouton à une fenêtre : le bouton l'ouvre, "Annuler" / "Non" / le fond sombre la ferment
function brancherFenetre(idBouton, idFenetre) {
  let bouton = document.getElementById(idBouton)
  let fenetre = document.getElementById(idFenetre)

  if (bouton === null || fenetre === null) { return }

  bouton.addEventListener('click', function () {
    fenetre.showModal()
  })

  fenetre.querySelectorAll('[data-modal-close]').forEach(function (boutonFermer) {
    boutonFermer.addEventListener('click', function () {
      fenetre.close()
    })
  })

  // Clic sur le fond sombre (en dehors de la carte) : on ferme aussi
  fenetre.addEventListener('click', function (evenement) {
    if (evenement.target === fenetre) {
      fenetre.close()
    }
  })

  // À la fermeture, on vide ce qui a été saisi (par exemple le mot de passe)
  fenetre.addEventListener('close', function () {
    fenetre.querySelectorAll('form').forEach(function (formulaire) { formulaire.reset() })
  })
}

// Changer de mot de passe : ancien mot de passe + nouveau + confirmation
brancherFenetre('open-password-dialog', 'password-dialog')

// Supprimer mon compte : confirmation avec le mot de passe
brancherFenetre('open-delete-dialog', 'delete-dialog')
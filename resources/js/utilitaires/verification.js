import {validerNomEnTempsReel, validerEmailEnTempsReel, validerCorrespondanceEmailEnTempsReel} from './validation.js'

// Fonction pour la vérification des champs lors de l'inscription
export function verificationChampsInscription() {
    const form = document.getElementById('registerForm');
    if (!form) {
        return;
    }
    const btnSubmit = document.getElementById('btnSumitInscription');

    // Récupération des fonctions de validation en temps réel
    const getNom = validerNomEnTempsReel('#last_name');
    const getPrenom = validerNomEnTempsReel('#first_name');
    const getEmail = validerEmailEnTempsReel('#email')
    const getEmailConfirm = validerCorrespondanceEmailEnTempsReel('#email', '#email_confirmation');
   

    // Fonction pour mettre à jour l'état du bouton
    function validerEtAfficherBouton() {
        const resultatNom = getNom();
        const resultatPrenom = getPrenom();
        const resultatEmail = getEmail();
        const resultatEmailConfirm = getEmailConfirm();



        const estValide = resultatNom && resultatPrenom && resultatEmail && resultatEmailConfirm;

        if (estValide) {
            // Afficher le bouton
            btnSubmit.classList.remove("hidden");
            btnSubmit.classList.add("block");
        } else {
            // Cacher le bouton
            btnSubmit.classList.add("hidden");
            btnSubmit.classList.remove("block");
        }
    }

    //  Écouter les modifications sur les champs du formulaire en temps réel
    form.addEventListener('input', validerEtAfficherBouton);

    // Gérer la soumission réelle du formulaire proprement
    form.addEventListener('submit', (event) => {
        const resultatNom = getNom();
        const resultatPrenom = getPrenom();
        const resultatEmail = getEmail();

        const estValide = resultatNom && resultatPrenom && resultatEmail;

        if (!estValide) {
            // Empêche l'envoi si ce n'est pas valide
            event.preventDefault(); 
        }
        // Si c'est valide, on laisse l'événement se propager et le formulaire s'envoyer (POST)
    });
}
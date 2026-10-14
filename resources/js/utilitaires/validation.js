export function validerNomEnTempsReel(selecteurOuElement, selecteurFeedback) {
    // Récupérer l'élément input via querySelector ou directement
    const inputElement = typeof selecteurOuElement === 'string'
        ? document.querySelector(selecteurOuElement)
        : selecteurOuElement;

    if (!inputElement) {
        console.error("L'élément spécifié est introuvable.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }

    // Regex autorisant les lettres (avec accents français), les espaces et les tiret
    // Refuse les chiffres et les caractères spéciaux
    const regexNom = /^[a-zA-ZÀ-ÿ\s\-]+$/;

    // Écouteur d'événement en temps réel pendant la frappe
    inputElement.addEventListener('input', (event) => {
        const valeur = event.target.value.trim();

        if (valeur === "") {
            feedbackElement.textContent = "Ce champ ne peut pas être vide.";
            feedbackElement.style.color = "#d97706"; // Orange/Avertissement
            return;
        }

        if (regexNom.test(valeur)) {
            feedbackElement.textContent = "Format valide ✓";
            feedbackElement.style.color = "#16a34a"; // Vert
        } else {
            feedbackElement.textContent = "Les chiffres et caractères spéciaux ne sont pas autorisés.";
            feedbackElement.style.color = "#dc2626"; // Rouge
        }
    });

    // Retourne une fonction de vérification finale qui renvoie la valeur ou false
    return function() {
        const valeurFinale = inputElement.value.trim();
        if (valeurFinale !== "" && regexNom.test(valeurFinale)) {
            return valeurFinale;
        }
        return false;
    };
}

// fonction pour valider l'email en temps réel avec feedback instantané
export function validerEmailEnTempsReel(selecteurOuElement, selecteurFeedback) {
    // Récupérer l'élément input via querySelector ou directement
    const inputElement = typeof selecteurOuElement === 'string'
        ? document.querySelector(selecteurOuElement)
        : selecteurOuElement;

    if (!inputElement) {
        console.error("L'élément spécifié est introuvable.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }

    // Regex standard pour valider le format d'un email
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Écouteur d'événement en temps réel pendant la frappe
    inputElement.addEventListener('input', (event) => {
        const valeur = event.target.value.trim();

        if (valeur === "") {
            feedbackElement.textContent = "Ce champ ne peut pas être vide.";
            feedbackElement.style.color = "#d97706"; // Orange/Avertissement
            return;
        }

        if (regexEmail.test(valeur)) {
            feedbackElement.textContent = "Adresse email valide ✓";
            feedbackElement.style.color = "#16a34a"; // Vert
        } else {
            feedbackElement.textContent = "Format d'email invalide (ex: exemple@domaine.com).";
            feedbackElement.style.color = "#dc2626"; // Rouge
        }
    });

    // Retourne une fonction de vérification finale qui renvoie la valeur ou false
    return function() {
        const valeurFinale = inputElement.value.trim();
        if (valeurFinale !== "" && regexEmail.test(valeurFinale)) {
            return valeurFinale;
        }
        return false;
    };
}

// fonction pour valider le mot de passe en temps réel avec feedback instantané
export function validerMotDePasseEnTempsReel(selecteurOuElement, selecteurFeedback) {
    // Récupérer l'élément input via querySelector ou directement
    const inputElement = typeof selecteurOuElement === 'string'
        ? document.querySelector(selecteurOuElement)
        : selecteurOuElement;

    if (!inputElement) {
        console.error("L'élément spécifié est introuvable.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }

    // Écouteur d'événement en temps réel pendant la frappe
    inputElement.addEventListener('input', (event) => {
        const valeur = event.target.value;

        if (valeur === "") {
            feedbackElement.textContent = "Ce champ ne peut pas être vide.";
            feedbackElement.style.color = "#d97706"; // Orange/Avertissement
            return;
        }

        // Vérification des critères requis
        const hasLetter = /[a-zA-Z]/.test(valeur);
        const hasDigit = /\d/.test(valeur);
        const hasSpecial = /[^a-zA-Z0-9]/.test(valeur);
        const isLongEnough = valeur.length >= 6;

        let elementsManquants = [];
        if (!isLongEnough) elementsManquants.push("6 caractères min.");
        if (!hasLetter) elementsManquants.push("1 lettre");
        if (!hasDigit) elementsManquants.push("1 chiffre");
        if (!hasSpecial) elementsManquants.push("1 caractère spécial");

        // Affichage dynamique du retour
        if (elementsManquants.length === 0) {
            feedbackElement.textContent = "Mot de passe sécurisé ✓";
            feedbackElement.style.color = "#16a34a"; // Vert
        } else {
            feedbackElement.textContent = "Manque : " + elementsManquants.join(", ");
            feedbackElement.style.color = "#dc2626"; // Rouge
        }
    });

    // Retourne une fonction de vérification finale qui renvoie la valeur ou false
    return function() {
        const valeurFinale = inputElement.value;
        const hasLetter = /[a-zA-Z]/.test(valeurFinale);
        const hasDigit = /\d/.test(valeurFinale);
        const hasSpecial = /[^a-zA-Z0-9]/.test(valeurFinale);
        const isLongEnough = valeurFinale.length >= 6;

        if (isLongEnough && hasLetter && hasDigit && hasSpecial) {
            return valeurFinale;
        }
        return false;
    };
}

// fonction pour valider le numéro de téléphone en temps réel avec feedback instantané
export function validerTelephoneEnTempsReel(selecteurOuElement, selecteurFeedback) {
    // Récupérer l'élément input via querySelector ou directement
    const inputElement = typeof selecteurOuElement === 'string'
        ? document.querySelector(selecteurOuElement)
        : selecteurOuElement;

    if (!inputElement) {
        console.error("L'élément spécifié est introuvable.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }

    // Regex pour le format international : 
    // Commence obligatoirement par un signe plus (+), suivi de 1 à 3 chiffres pour l'indicatif du pays, 
    // puis de 6 à 12 chiffres pour le numéro national (autorise parfois un espace ou un tiret optionnel).
    const regexTelephone = /^\+\d{1,3}[\s\-]?\d{6,12}$/;

    // Écouteur d'événement en temps réel pendant la frappe
    inputElement.addEventListener('input', (event) => {
        const valeur = event.target.value.trim();

        if (valeur === "") {
            feedbackElement.textContent = "Ce champ ne peut pas être vide.";
            feedbackElement.style.color = "#d97706"; // Orange/Avertissement
            return;
        }

        // Vérification partielle pour guider pendant la frappe
        if (!valeur.startsWith("+")) {
            feedbackElement.textContent = "Le numéro doit commencer par un indicatif (ex: +243...)";
            feedbackElement.style.color = "#d97706";
            return;
        }

        if (regexTelephone.test(valeur)) {
            feedbackElement.textContent = "Numéro de téléphone valide ✓";
            feedbackElement.style.color = "#16a34a"; // Vert
        } else {
            feedbackElement.textContent = "Format invalide (ex: +243823310484)";
            feedbackElement.style.color = "#dc2626"; // Rouge
        }
    });

    // Retourne une fonction de vérification finale qui renvoie la valeur ou false
    return function() {
        const valeurFinale = inputElement.value.trim();
        if (valeurFinale !== "" && regexTelephone.test(valeurFinale)) {
            return valeurFinale;
        }
        return false;
    };
}

// fonction pour valider le message en temps réel avec feedback instantané
export function validerMessageEnTempsReel(selecteurOuElement, selecteurFeedback) {
    // Récupérer l'élément input/textarea via querySelector ou directement
    const inputElement = typeof selecteurOuElement === 'string'
        ? document.querySelector(selecteurOuElement)
        : selecteurOuElement;

    if (!inputElement) {
        console.error("L'élément spécifié est introuvable.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }

    // Regex pour détecter les tentatives d'injection de balises HTML ou scripts (XSS)
    // Elle repère la présence de balises comme <script>, <iframe>, <img onerror=...>, etc.
    const regexXSS = /<\s*([a-zA-Z]+)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<[a-zA-Z][^>]*\/>|<[a-zA-Z][^>]*>/;

    // Écouteur d'événement en temps réel pendant la frappe
    inputElement.addEventListener('input', (event) => {
        const valeur = event.target.value.trim();

        if (valeur === "") {
            feedbackElement.textContent = "Le message ne peut pas être vide.";
            feedbackElement.style.color = "#d97706"; // Orange/Avertissement
            return;
        }

        if (valeur.length < 2) {
            feedbackElement.textContent = "Votre message est un peu court (minimum 2 caractères).";
            feedbackElement.style.color = "#d97706";
            return;
        }

        // Vérification de la présence de code malveillant/balises HTML
        if (regexXSS.test(valeur)) {
            feedbackElement.textContent = "Caractères ou balises HTML interdits (risque de piratage).";
            feedbackElement.style.color = "#dc2626"; // Rouge
        } else {
            feedbackElement.textContent = "Message valide ✓";
            feedbackElement.style.color = "#16a34a"; // Vert
        }
    });

    // Retourne une fonction de vérification finale qui renvoie la valeur ou false
    return function() {
        const valeurFinale = inputElement.value.trim();
        if (valeurFinale !== "" && valeurFinale.length >= 2 && !regexXSS.test(valeurFinale)) {
            return valeurFinale;
        }
        return false;
    };
}

export function validerCorrespondanceEmailEnTempsReel(selecteurEmailOriginal, selecteurEmailConfirmation, selecteurFeedback) {
    // Récupérer les deux éléments input du DOM
    const inputOriginal = typeof selecteurEmailOriginal === 'string'
        ? document.querySelector(selecteurEmailOriginal)
        : selecteurEmailOriginal;

    const inputConfirmation = typeof selecteurEmailConfirmation === 'string'
        ? document.querySelector(selecteurEmailConfirmation)
        : selecteurEmailConfirmation;

    if (!inputOriginal || !inputConfirmation) {
        console.error("L'un des champs email spécifiés est introuvable dans le DOM.");
        return () => false;
    }

    // Gérer l'élément de feedback (remarques instantanées sous le champ de confirmation)
    let feedbackElement = selecteurFeedback ? document.querySelector(selecteurFeedback) : null;
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.style.fontSize = '0.85rem';
        feedbackElement.style.marginTop = '5px';
        inputConfirmation.parentNode.insertBefore(feedbackElement, inputConfirmation.nextSibling);
    }

    // Regex standard pour valider la structure de l'email
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Fonction de vérification mutualisée pour le temps réel
    function verifier() {
        const valOriginal = inputOriginal.value.trim();
        const valConfirmation = inputConfirmation.value.trim();

        if (valConfirmation === "") {
            feedbackElement.textContent = "Veuillez confirmer votre email.";
            feedbackElement.style.color = "#d97706"; // Orange
            return false;
        }

        if (!regexEmail.test(valConfirmation)) {
            feedbackElement.textContent = "Format d'email invalide.";
            feedbackElement.style.color = "#dc2626"; // Rouge
            return false;
        }

        if (valOriginal !== valConfirmation) {
            feedbackElement.textContent = "Les adresses email ne correspondent pas.";
            feedbackElement.style.color = "#dc2626"; // Rouge
            return false;
        }

        feedbackElement.textContent = "Les emails correspondent parfaitement ✓";
        feedbackElement.style.color = "#16a34a"; // Vert
        return true;
    }

    // Écouter les modifications sur les DEUX champs (pour mettre à jour l'affichage si l'utilisateur modifie le premier ou le second)
    inputConfirmation.addEventListener('input', verifier);
    inputOriginal.addEventListener('input', () => {
        if (inputConfirmation.value.trim() !== "") {
            verifier();
        }
    });

    // Retourne une fonction de vérification finale pour la soumission
    return function() {
        const valConfirmation = inputConfirmation.value.trim();
        const estValide = verifier();
        if (estValide && valConfirmation !== "") {
            return valConfirmation;
        }
        return false;
    };
}
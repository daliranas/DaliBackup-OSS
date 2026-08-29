# 🤝 Guide de Contribution & Stratégie de Branches — DaliBackup-OSS

Merci de contribuer au projet **DaliBackup-OSS** !  
Afin de garantir la stabilité, la sécurité et la traçabilité du code, ce projet applique un modèle de branches strict inspiré des grands projets open source d'entreprise.

---

## 🌳 Stratégie des Branches (Branching Workflow)

Le flux de développement suit un pipeline hiérarchique rigoureux en 4 niveaux :

```
┌─────────────────────────────────────────────────────────────┐
│   1. Branches Contributeurs : $username/<feature|fix|dev>   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Pull Request + CI Check)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   2. Branche d'Intégration Active : development             │
└──────────────────────────────┬──────────────────────────────┘
                               │ (PR + Revue Obligatoire par @daliranas)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   3. Branche Principale Protégée : main                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Tag de version & Release Engine)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   4. Branches & Releases Officielles : release/vX.Y.Z       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📌 Rôles et Règles des Branches

| Branche / Préfixe | Rôle & Permissions | Cible des Pull Requests |
| :--- | :--- | :--- |
| **`main`** | 🔒 **Branche de production protégée**. Aucun push direct autorisé. Seul le mainteneur principal (`@daliranas`) peut approuver et fusionner les PRs. Les 6 tests CI/CD doivent être 100% au vert. | Reçoit les PRs depuis `development` ou `hotfix/*`. |
| **`development`** | 🛠️ **Branche principale d'intégration**. Contient les dernières fonctionnalités en cours de stabilisation et de tests. | Reçoit les PRs des branches contributeurs `$username/*`. |
| **`release/vX.Y.Z`** | 📦 **Branches de versionnement & gel de code**. Utilisées pour préparer les builds de distribution et les binaires finaux. | Dérivée de `main` lors de la publication d'une release officielle. |
| **`$username/*`** | 👤 **Branches individuelles de travail des contributeurs** (ex: `johndoe/feature-s3`, `alice/fix-cors`, `bastien-dev`). | Crée une Pull Request vers **`development`**. |

---

## 🚀 Comment Contribuer Étape par Étape

### 1. Cloner et créer votre branche de travail
```bash
# Récupérer les dernières modifications
git checkout development
git pull origin development

# Créer votre branche selon la convention : <votre_pseudo>/<nom_de_branche>
git checkout -b $username/nom-de-votre-fonctionnalite
```

### 2. Développer et valider les tests localement
```bash
# Vérifier la compilation TypeScript
npm run build

# Exécuter les 8 tests unitaires et les 15 tests E2E HTTP de l'API
npm test
```

### 3. Pousser et ouvrir votre Pull Request vers `development`
```bash
git add .
git commit -m "feat(module): description claire du changement"
git push -u origin $username/nom-de-votre-fonctionnalite
```
* Rendez-vous sur GitHub et ouvrez une Pull Request avec comme branche de base (Base Branch) : **`development`**.
* Remplissez le modèle de Pull Request.

### 4. Revue de Code & Fusion vers `main`
* Une fois validée sur `development`, les fonctionnalités stables sont rassemblées dans une PR globale vers **`main`**.
* La fusion sur `main` est **strictement soumise à l'approbation du mainteneur principal (@daliranas)** et au passage de tous les tests CI/CD.

---

## ⚖️ Conformité Légale & Propriété Intellectuelle
* Toutes les contributions doivent respecter la licence **DaliBackup Open Source Software**.
* Les mentions de copyright, de marque et de paternité de **Bastien LANGUEDOC (Daliranas)** doivent être préservées dans l'ensemble des fichiers modifiés.

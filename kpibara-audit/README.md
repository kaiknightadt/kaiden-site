# KPIbara — Diagnostic Business Gratuit

Outil de diagnostic interactif pour qualifier des leads et vendre des solutions d'automatisation sur mesure.

## Déploiement rapide sur Netlify (via GitHub)

### 1. Créer le repo GitHub
```bash
cd kpibara-audit
git init
git add .
git commit -m "🍰 KPIbara diagnostic tool"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/kpibara-audit.git
git push -u origin main
```

### 2. Connecter à Netlify
1. Va sur [app.netlify.com](https://app.netlify.com)
2. "Add new site" → "Import an existing project" → GitHub
3. Sélectionne le repo `kpibara-audit`
4. Build settings :
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
5. Deploy !

### 3. (Optionnel) Sous-domaine custom
Tu peux configurer un sous-domaine comme `diagnostic.kpibara.netlify.app` dans les settings Netlify.

## Stack
- React 18 + Vite
- API Claude (Anthropic) pour le diagnostic IA
- Zéro dépendance externe (tout inline)

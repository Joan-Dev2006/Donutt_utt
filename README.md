# DonUTT - Comparateur Agnostique d'Analyse de Cycle de Vie (ACV)

**DonUTT** est un outil de visualisation interactif (basé sur D3.js) développé dans le cadre de la traduction d'un modèle d'Ingénierie Système (SysML) vers le modèle socio-écologique de Kate Raworth (La Théorie du Donut).

## 🎯 Objectif
L'outil permet de comparer les impacts socio-écologiques de deux systèmes socio-techniques (ex: un train vs un bus) en important directement les nomenclatures (BOM) ou les vues de définition de blocs (bdd) issues du modèle SysML. 

## 🏗️ Architecture du projet (Agnostique)
L'outil est conçu pour être 100% agnostique et évolutif. Le code JavaScript ne contient aucune donnée codée "en dur".
* `index.html` : L'interface utilisateur (Dashboard comparatif).
* `script.js` : Le moteur de calcul mathématique et le moteur de rendu D3.js.
* `data/base_reference.js` : La base de données JSON externe contenant les seuils par habitant et les impacts par zone géographique.

**Note aux chercheurs :** Si de nouveaux indicateurs ou de nouvelles zones géographiques doivent être ajoutés à l'avenir, il suffit de mettre à jour le fichier `base_reference.js`. L'outil s'adaptera automatiquement sans modifier le code source.

## 🚀 Comment utiliser l'outil
1. Ouvrir le tableau de bord (Lien GitHub Pages).
2. Utiliser le fichier modèle **Excel (Générateur DonUTT)** pour préparer les données d'entrée. 
3. Le format requis (export du modèle SysML) doit contenir les colonnes suivantes : `composant`, `phase`, `pays`, `per_eq`.
4. Enregistrer le fichier Excel au format `.csv` (séparateur point-virgule).
5. Importer le fichier dans le tableau de bord pour générer le graphique.

## 🛠️ Technologies utilisées
* HTML5 / CSS3
* JavaScript (ES6)
* D3.js (v7)

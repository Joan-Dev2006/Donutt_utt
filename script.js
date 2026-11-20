// =========================================================================
// 1. ARCHITECTURE DES DONNÉES ET MOTEUR DE CALCUL (Agnostique)
// Ce script utilise la constante BASE_REFERENCE chargée via index.html
// =========================================================================

class SystemeSocioTechnique {
    constructor(nom) {
        this.nom = nom;
        this.modeleRaworth = { plafondEcologique: [], plancherSocial: [] };
    }
}

// Dictionnaire des unités physiques pour les indicateurs écologiques
const UNITES = {
    "CO2 Emissions": "kg CO2",
    "Phosphorus": "kg P",
    "Nitrogen": "kg N",
    "Blue Water": "m³",
    "eHANPP": "tC",
    "Ecological Footprint": "gha",
    "Material Footprint": "tonnes"
};

// Stockage dynamique de 1 à N systèmes
const systemes = {};
let compteurScenarios = 0;

// Moteur d'Analyse (Traduction mathématique de l'article)
function analyserCycleDeVie(dataCSV, systemName) {
    
    if (typeof BASE_REFERENCE === 'undefined') {
        alert("Erreur critique : La base de données de référence est introuvable. Avez-vous bien inclus base_reference.js dans index.html ?");
        return null;
    }

    let systeme = new SystemeSocioTechnique(systemName);
    const seuilsEco = BASE_REFERENCE.SEUILS_ECO_PER_CAPITA;
    const bddPays = BASE_REFERENCE.BDD_PAYS;
    
    // 1. Calcul du total des Equivalent Persons
    let sumNbEqPers = 0;
    dataCSV.forEach(row => { sumNbEqPers += parseFloat(row.per_eq); });

    // 2. Calcul du Plafond Écologique (Overshoot)
    for (let indicateur in seuilsEco) {
        let impactTotal = 0;
        dataCSV.forEach(row => {
            let pays = row.pays.toUpperCase().trim();
            if (bddPays[pays] && bddPays[pays].eco[indicateur] !== undefined) {
                impactTotal += parseFloat(row.per_eq) * bddPays[pays].eco[indicateur];
            }
        });
        
        let seuilTotal = sumNbEqPers * seuilsEco[indicateur];
        let ratio = seuilTotal > 0 ? (impactTotal / seuilTotal) : 1; 
        
        systeme.modeleRaworth.plafondEcologique.push({
            dimension: indicateur, type: "Ecologique",
            valeur_mesure: impactTotal, seuil_reference: seuilTotal, unite: "total", ratio: ratio
        });
    }

    // 3. Calcul du Plancher Social (Shortfall)
    const indSociaux = Object.keys(bddPays["FRANCE"].soc);
    for (let indicateur of indSociaux) {
        let scorePondere = 0;
        dataCSV.forEach(row => {
            let pays = row.pays.toUpperCase().trim();
            if (bddPays[pays] && bddPays[pays].soc[indicateur] !== undefined) {
                scorePondere += (parseFloat(row.per_eq) / sumNbEqPers) * bddPays[pays].soc[indicateur];
            }
        });
        
        let ratio = scorePondere > 0 ? (1.0 / scorePondere) : 1; 
        
        systeme.modeleRaworth.plancherSocial.push({
            dimension: indicateur, type: "Social",
            valeur_mesure: scorePondere, seuil_reference: 1.0, unite: "score", ratio: ratio
        });
    }

    return systeme;
}

// =========================================================================
// 2. GESTION DYNAMIQUE DES SCÉNARIOS (1 à N Doughnuts)
// =========================================================================

function creerModeleVide() {
    let modeleVide = { plafondEcologique: [], plancherSocial: [] };
    for (let i = 0; i < 7; i++) {
        modeleVide.plafondEcologique.push({ dimension: "Waiting...", type: "Ecologique", ratio: 0, valeur_mesure: 0, seuil_reference: 0 });
    }
    for (let i = 0; i < 11; i++) {
        modeleVide.plancherSocial.push({ dimension: "Waiting...", type: "Social", ratio: 0, valeur_mesure: 0, seuil_reference: 0 });
    }
    return modeleVide;
}

function ajouterScenario() {
    compteurScenarios++;
    const scenarioId = `scenario-${compteurScenarios}`;
    const container = document.getElementById("comparison-layout");

    // Création de la colonne du système
    const col = document.createElement("div");
    col.className = "system-column";
    col.id = `col-${scenarioId}`;

    col.innerHTML = `
        <div class="import-box">
            <button class="btn-remove" title="Remove this system" onclick="supprimerScenario('${scenarioId}')">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h3 id="nom-systeme-${scenarioId}">Socio-Technical System ${compteurScenarios}</h3>
            <input type="file" id="upload-${scenarioId}" accept=".csv">
        </div>
        <div id="chart-${scenarioId}" class="chart-wrapper"></div>
    `;

    container.appendChild(col);

    // Écouteur sur l'input file
    const fileInput = document.getElementById(`upload-${scenarioId}`);
    fileInput.addEventListener("change", function () {
        chargerFichierCSV(this.files[0], scenarioId);
    });

    // Dessin initial du Doughnut vide
    dessinerDonut(creerModeleVide(), `#chart-${scenarioId}`);
    mettreAJourBoutonsSuppression();
}

function supprimerScenario(scenarioId) {
    const col = document.getElementById(`col-${scenarioId}`);
    if (col) col.remove();
    delete systemes[scenarioId];
    mettreAJourBoutonsSuppression();
}

// Masque le bouton "×" s'il ne reste qu'un seul Doughnut affiché
function mettreAJourBoutonsSuppression() {
    const boutons = document.querySelectorAll(".btn-remove");
    const afficher = boutons.length > 1;
    boutons.forEach(btn => {
        btn.style.display = afficher ? "flex" : "none";
    });
}

// Fonction appelée lors de l'importation d'un CSV
function chargerFichierCSV(file, scenarioId) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const contenu = e.target.result;
        let data = d3.csvParse(contenu);
        if (data.length === 0 || !data[0].pays) data = d3.dsvFormat(";").parse(contenu); 

        if (data.length === 0 || !data[0].pays || !data[0].per_eq || !data[0].composant) {
            alert("Format incorrect. Importez un export SysML valide avec les colonnes : composant, phase, pays, per_eq");
            return;
        }

        let systemeCalcule = analyserCycleDeVie(data, file.name.replace(/\.csv$/i, ""));
        if (!systemeCalcule) return;

        systemes[scenarioId] = systemeCalcule;
        
        document.getElementById(`nom-systeme-${scenarioId}`).innerText = systemeCalcule.nom.toUpperCase();
        dessinerDonut(systemeCalcule.modeleRaworth, `#chart-${scenarioId}`);
    };
    reader.readAsText(file);
}

// Initialisation : 1 seul Doughnut par défaut au chargement
window.onload = function() {
    ajouterScenario();
};

// =========================================================================
// 3. MOTEUR DE DESSIN D3.JS (Responsive via viewBox + IDs isolés)
// =========================================================================

function dessinerDonut(donneesModele, selecteurDiv) {
    
    d3.select(selecteurDiv).selectAll("*").remove();

    const width = 600; 
    const height = 600;
    const center = width / 2;

    const rLogo = 35;          
    const rSocInner = 130;     
    const rEcoOuter = 205;     
    const rEcoMax = 280;       

    const colCyan = "#00b4e8";      
    const colDarkBlue = "#0c2340";  
    const colLightBg = "#f4fbfe";   
    const colScale = "rgba(30, 55, 90, 0.25)";      

    // SVG responsive grâce à viewBox
    const svg = d3.select(selecteurDiv).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g").attr("transform", `translate(${center}, ${center})`);

    const defs = svg.append("defs");
    const uniqueIdSuffix = selecteurDiv.replace("#", ""); 
    
    // --- FONCTION DE COULEUR DYNAMIQUE ---
    function getColorForRatio(ratio) {
        if (ratio <= 1) return "rgba(255, 255, 255, 0)"; 
        
        let depassement = ratio - 1;
        let intensity = Math.min(depassement / 1.5, 1); 
        
        let gValue = Math.round(255 * (1 - intensity));
        return `rgb(255, ${gValue}, 0)`;
    }

    // Création de dégradés dynamiques
    donneesModele.plafondEcologique.forEach((d, i) => {
        let gradientId = `gradEco-${uniqueIdSuffix}-${i}`;
        let targetColor = getColorForRatio(d.ratio);
        
        const grad = defs.append("radialGradient").attr("id", gradientId).attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", rEcoMax);
        grad.append("stop").attr("offset", (rEcoOuter / rEcoMax) * 100 + "%").attr("stop-color", targetColor);
        grad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255, 255, 255, 0)");
    });

    donneesModele.plancherSocial.forEach((d, i) => {
        let gradientId = `gradSoc-${uniqueIdSuffix}-${i}`;
        let targetColor = getColorForRatio(d.ratio);
        
        const grad = defs.append("radialGradient").attr("id", gradientId).attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", rSocInner);
        grad.append("stop").attr("offset", "15%").attr("stop-color", "rgba(255, 255, 255, 0)");
        grad.append("stop").attr("offset", "100%").attr("stop-color", targetColor);
    });

    function getTextPath(d, radius) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const isBottom = angle > Math.PI / 2 && angle < 3 * Math.PI / 2;
        let start = d.startAngle, end = d.endAngle;
        if (isBottom) {
            return `M ${Math.sin(end)*radius} ${-Math.cos(end)*radius} A ${radius} ${radius} 0 0 0 ${Math.sin(start)*radius} ${-Math.cos(start)*radius}`;
        } else {
            return `M ${Math.sin(start)*radius} ${-Math.cos(start)*radius} A ${radius} ${radius} 0 0 1 ${Math.sin(end)*radius} ${-Math.cos(end)*radius}`;
        }
    }

    const pie = d3.pie().value(1).sort(null).padAngle(0); 
    const arcsEco = pie(donneesModele.plafondEcologique);
    const arcsSoc = pie(donneesModele.plancherSocial);

    // Chemins pour les textes
    defs.selectAll(".textPathEco").data(arcsEco).join("path")
        .attr("id", (d, i) => "text-path-eco-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rEcoMax + 10));

    defs.selectAll(".textPathSoc1").data(arcsSoc).join("path")
        .attr("id", (d, i) => "text-path-soc1-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rSocInner - 10));

    defs.selectAll(".textPathSoc2").data(arcsSoc).join("path")
        .attr("id", (d, i) => "text-path-soc2-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rSocInner - 22));

    // Fonds de base
    svg.selectAll(".bg-eco").data(arcsEco).join("path").attr("d", d3.arc().innerRadius(rEcoOuter).outerRadius(rEcoMax)).attr("fill", colLightBg);
    svg.selectAll(".bg-soc").data(arcsSoc).join("path").attr("d", d3.arc().innerRadius(rLogo).outerRadius(rSocInner)).attr("fill", colLightBg);

    // Echelles grisées
    const maxSafeThickness = 20; 
    const gap = 0.03; 
    svg.selectAll(".scale-soc").data(arcsSoc).join("path").attr("d", d => d3.arc().innerRadius(rSocInner).outerRadius(rSocInner + maxSafeThickness).startAngle(d.startAngle + gap).endAngle(d.endAngle - gap)()).attr("fill", colScale);
    svg.selectAll(".scale-eco").data(arcsEco).join("path").attr("d", d => d3.arc().innerRadius(rEcoOuter - maxSafeThickness).outerRadius(rEcoOuter).startAngle(d.startAngle + gap).endAngle(d.endAngle - gap)()).attr("fill", colScale);

    // LIGNES BLANCHES
    arcsSoc.forEach(d => { svg.append("line").attr("x1", Math.sin(d.startAngle)*rLogo).attr("y1", -Math.cos(d.startAngle)*rLogo).attr("x2", Math.sin(d.startAngle)*rSocInner).attr("y2", -Math.cos(d.startAngle)*rSocInner).attr("stroke", "white").attr("stroke-width", 4); });
    arcsEco.forEach(d => { svg.append("line").attr("x1", Math.sin(d.startAngle)*rEcoOuter).attr("y1", -Math.cos(d.startAngle)*rEcoOuter).attr("x2", Math.sin(d.startAngle)*rEcoMax).attr("y2", -Math.cos(d.startAngle)*rEcoMax).attr("stroke", "white").attr("stroke-width", 4); });

    // TRACÉ DES PÉTALES DYNAMIQUES
    function drawPetals(arcs, isEco) {
        const petalGap = 0.015; 
        svg.selectAll(isEco ? ".red-eco" : ".red-soc").data(arcs).join("path")
            .attr("d", d => {
                let depassement = d.data.ratio - 1; 
                if (depassement <= 0) return ""; 
                let intensite = Math.min(depassement, 1.5) / 1.5; 
                
                if (isEco) {
                    let thickness = (rEcoMax - rEcoOuter) * intensite; 
                    return d3.arc().innerRadius(rEcoOuter).outerRadius(rEcoOuter + thickness).startAngle(d.startAngle + petalGap).endAngle(d.endAngle - petalGap)();  
                } else {
                    let thickness = (rSocInner - rLogo) * intensite;
                    return d3.arc().innerRadius(rSocInner - thickness).outerRadius(rSocInner).startAngle(d.startAngle + petalGap).endAngle(d.endAngle - petalGap)(); 
                }
            })
            .attr("fill", (d, i) => isEco ? `url(#gradEco-${uniqueIdSuffix}-${i})` : `url(#gradSoc-${uniqueIdSuffix}-${i})`);
    }
    
    drawPetals(arcsEco, true);
    drawPetals(arcsSoc, false);

    // Cercles bleus
    svg.append("circle").attr("r", rSocInner + ((rEcoOuter - rSocInner)/2)).attr("fill", "none").attr("stroke", colCyan).attr("stroke-width", rEcoOuter - rSocInner);
    svg.append("circle").attr("r", rSocInner).attr("fill", "none").attr("stroke", colDarkBlue).attr("stroke-width", "3px");
    svg.append("circle").attr("r", rEcoOuter).attr("fill", "none").attr("stroke", colDarkBlue).attr("stroke-width", "3px");

    // TEXTES ÉCOLOGIQUES (Anglais)
    svg.selectAll(".curved-text-eco").data(arcsEco).join("text")
        .attr("dy", d => {
            const angle = (d.startAngle + d.endAngle) / 2;
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? 12 : -2; 
        })
        .append("textPath").attr("href", (d, i) => "#text-path-eco-" + uniqueIdSuffix + "-" + i).attr("startOffset", "50%")
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold").style("fill", colDarkBlue).style("letter-spacing", "1px")
        .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
        .text(d => {
            let label = d.data.dimension.toUpperCase(); 
            return label.length > 22 ? label.substring(0, 20) + "." : label;
        });

    // TEXTES SOCIAUX (Anglais)
    const socTextGroups = svg.selectAll(".curved-text-soc").data(arcsSoc).join("g");
    socTextGroups.each(function(d, i) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const isBottom = angle > Math.PI / 2 && angle < 3 * Math.PI / 2;
        let dyVal = isBottom ? 10 : -2;

        let mots = d.data.dimension.toUpperCase().trim().split(/\s+/); 
        const group = d3.select(this);

        if (mots.length === 1) {
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc1-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(mots[0].substring(0, 14));
        } else {
            let ligne1 = mots[0];
            let ligne2 = mots.slice(1).join(" ");
            
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc2-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(ligne1.substring(0, 14));
                
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc1-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(ligne2.substring(0, 14) + (ligne2.length > 14 ? "." : ""));
        }
    });

    // LOGO CENTRAL
    const logoGroup = svg.append("g");
    logoGroup.append("rect").attr("x", -20).attr("y", -20).attr("width", 40).attr("height", 40).attr("fill", colDarkBlue).attr("rx", 5);
    logoGroup.append("ellipse").attr("cx", 0).attr("cy", 0).attr("rx", 12).attr("ry", 5).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 2).attr("transform", "rotate(-20)");
    logoGroup.append("circle").attr("cx", -2).attr("cy", 1).attr("r", 2).attr("fill", "white");

    // HITBOX, INFO-BULLE ET MODALE
    const tooltip = d3.select("#tooltip");
    svg.selectAll(".hitbox").data([...arcsSoc, ...arcsEco]).join("path")
        .attr("d", d => d3.arc().innerRadius(d.data.type === "Social" ? rLogo : rSocInner).outerRadius(d.data.type === "Social" ? rEcoOuter : rEcoMax).startAngle(d.startAngle).endAngle(d.endAngle)())
        .attr("fill", "transparent").style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "rgba(0,0,0,0.05)");
            
            let isEco = d.data.type === "Ecologique";
            let etat = d.data.ratio > 1
                ? (isEco ? "⚠️ OVERSHOOT" : "⚠️ SHORTFALL")
                : (isEco ? "✅ SAFE" : "✅ ACHIEVED");
            let couleurEtat = d.data.ratio > 1 ? "#ffcc00" : "#00ff00";
            
            tooltip.style("opacity", 1).html(`
                <strong style="font-size:14px;">${d.data.dimension}</strong><br><br>
                Measure : ${d.data.valeur_mesure.toLocaleString('en-US', {maximumFractionDigits: 2})}<br>
                Boundary : ${d.data.seuil_reference.toLocaleString('en-US', {maximumFractionDigits: 2})}<br>
                <span style="color:${couleurEtat}; font-weight:bold; margin-top:5px; display:block;">${etat}</span>
            `);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY + 15) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "transparent");
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            
            let isEco = d.data.type === "Ecologique";
            let ratio = d.data.ratio;
            let unite = isEco ? (UNITES[d.data.dimension] || "") : "";

            document.getElementById('m-title').innerHTML = d.data.dimension;
            document.getElementById('m-unite').innerHTML = isEco ? "Total Impact" : "Weighted Social Score";
            
            document.getElementById('m-valeur-mesure').innerHTML = d.data.valeur_mesure.toLocaleString('fr-FR', {maximumFractionDigits: 2}) + 
                `<span style="font-size: 20px; color: #829ab1; margin-left: 8px; font-weight: normal;">${unite}</span>`;
            
            document.getElementById('m-seuil-ref').innerHTML = d.data.seuil_reference.toLocaleString('fr-FR', {maximumFractionDigits: 2}) + 
                `<span style="font-size: 16px; margin-left: 5px; font-weight: normal;">${unite}</span>`;
            
            document.getElementById('m-ratio-affiche').innerHTML = ratio.toLocaleString('fr-FR', {maximumFractionDigits: 2});

            if (isEco) {
                if (ratio > 1) {
                    document.getElementById('m-status-text').innerHTML = "⚠️ OVERSHOOT";
                    document.getElementById('m-status-text').style.color = "#ffcccc";
                    let depass = ((ratio - 1) * 100).toFixed(0);
                    document.getElementById('m-explication').innerHTML = `The impact of this system is <strong>${depass}% higher</strong> than the authorized ecological limit for this population. It contributes to planetary overshoot.`;
                } else {
                    document.getElementById('m-status-text').innerHTML = "✅ SAFE ZONE";
                    document.getElementById('m-status-text').style.color = "white";
                    document.getElementById('m-explication').innerHTML = `The impact of this system perfectly respects the authorized ecological ceiling.`;
                }
            } else {
                if (ratio > 1) {
                    document.getElementById('m-status-text').innerHTML = "⚠️ SHORTFALL";
                    document.getElementById('m-status-text').style.color = "#ffcccc";
                    document.getElementById('m-explication').innerHTML = `This system fails to meet the minimum social foundation required for the well-being of the population.`;
                } else {
                    document.getElementById('m-status-text').innerHTML = "✅ ACHIEVED";
                    document.getElementById('m-status-text').style.color = "white";
                    document.getElementById('m-explication').innerHTML = `This system contributes positively and satisfies basic social needs on this indicator.`;
                }
            }

            let positionJauge = 50;
            if (isEco) {
                document.getElementById('m-jauge-gauche').innerHTML = "Safe (0)";
                document.getElementById('m-jauge-centre').innerHTML = "Boundary (1)";
                document.getElementById('m-jauge-droite').innerHTML = "Overshoot (>1)";
            } else {
                document.getElementById('m-jauge-gauche').innerHTML = "Achieved (0)";
                document.getElementById('m-jauge-centre').innerHTML = "Foundation (1)";
                document.getElementById('m-jauge-droite').innerHTML = "Shortfall (>1)";
            }

            if (ratio > 1) {
                positionJauge = Math.min(100, 50 + ((ratio - 1) * 25)); 
            } else {
                positionJauge = Math.max(0, ratio * 50); 
            }

            document.getElementById('m-jauge-curseur').style.left = `${positionJauge}%`;
            document.getElementById('modal-overlay').style.display = 'flex';
        });
}
const width = 800;
const height = 800;
const center = width / 2;

// Rayons ajustés pour laisser respirer le graphique
const rBlue = 90;         
const rSocialOuter = 160;  
const rEcoOuter = 230;     
const step = 20;           

const colBlue = "#b3e5fc";      
const colSocGreen = "#a5d6a7";  
const colEcoGreen = "#4caf50";  

// Dictionnaire des icônes FontAwesome (Unicode)
const iconMap = {
    "GES_01": "\uf0c2", // fa-cloud
    "SOL_01": "\uf1bb", // fa-tree
    "AIR_01": "\uf72e", // fa-wind
    "BIO_01": "\uf06c", // fa-leaf
    "EAU_01": "\uf043", // fa-droplet
    "SAN_01": "\uf067", // fa-plus
    "COH_01": "\uf2b5", // fa-handshake
    "JUS_01": "\uf24e", // fa-balance-scale
    "TRA_01": "\uf0b1"  // fa-briefcase
};

// Recommandations issues du rapport de M. Lemonnier
const recoMap = {
    "GES_01": "Optimiser en priorité le bâtiment X (potentiel de -553 MWh/an) et encadrer les destinations de stages internationaux pour limiter l'aérien.",
    "SOL_01": "Préserver les 6,2 hectares d'espaces verts actuels et désimperméabiliser les parkings (qui représentent 60% des sols artificialisés).",
    "AIR_01": "Promouvoir les mobilités douces et augmenter le taux de covoiturage (actuellement à 1,4 pers/véhicule).",
    "BIO_01": "Poursuivre l'inventaire écologique de 2026 et sanctuariser la forêt Miyawaki de 1 300 arbres.",
    "EAU_01": "Maintenir la consommation soutenable (actuellement 6 000 m³) et auditer les fuites potentielles sur le réseau d'eau potable.",
    "SAN_01": "Lancer un baromètre bien-être annuel (Action A8) et renforcer la communication sur les aides (ignorées par 75% des étudiants).",
    "COH_01": "Créer une vitrine permanente DD&RS (Action M1) dans le couloir principal pour valoriser l'engagement collectif.",
    "JUS_01": "Poursuivre le plan EDI et intégrer un module obligatoire 'DD&RS et conditions de travail' dans le tronc commun (Action M2).",
    "TRA_01": "Améliorer les conditions de travail en nommant officiellement les référents vacants (achats responsables et déchets)."
};

const svg = d3.select("#chart").append("svg")
    .attr("width", width).attr("height", height)
    .append("g")
    .attr("transform", `translate(${center}, ${center})`);

// Grille
for(let i=1; i<=5; i++) {
    svg.append("circle").attr("r", rEcoOuter + (step*i)).attr("class", "grid-line"); 
    svg.append("circle").attr("r", Math.max(0, rBlue - (step*i))).attr("class", "grid-line"); 
}

svg.append("circle").attr("r", rBlue).attr("fill", colBlue).attr("stroke", "#ffffff").attr("stroke-width", "3px");

// Appel au fichier JSON
d3.json("data/donutt_prototype.json").then(data => {
    
    const dataEco = data.indicateurs.filter(d => d.type === "Ecologique");
    const dataSoc = data.indicateurs.filter(d => d.type === "Social");

    const pie = d3.pie().value(1).sort(null).padAngle(0); 
    const arcsEco = pie(dataEco);
    const arcsSoc = pie(dataSoc);
    
    const colorScale = d3.scaleOrdinal()
        .domain([1, 2, 3, 4, 5])
        .range([colEcoGreen, "#ffcdd2", "#ef5350", "#d32f2f", "#d81b60"]); 

    const tooltip = d3.select("#tooltip");

    // 1. ANNEAUX DE BASE
    svg.selectAll(".safe-soc").data(arcsSoc).join("path")
        .attr("class", "safe-soc")
        .attr("d", d3.arc().innerRadius(rBlue).outerRadius(rSocialOuter))
        .attr("fill", colSocGreen).attr("stroke", "#ffffff").attr("stroke-width", "2px");

    svg.selectAll(".safe-eco").data(arcsEco).join("path")
        .attr("class", "safe-eco")
        .attr("d", d3.arc().innerRadius(rSocialOuter).outerRadius(rEcoOuter))
        .attr("fill", colEcoGreen).attr("stroke", "#ffffff").attr("stroke-width", "2px");

    // 2. PÉTALES D'ALERTE ROUGES
    function drawPetals(arcs, isEco) {
        svg.selectAll(isEco ? ".petal-eco" : ".petal-soc")
            .data(arcs).join("path")
            .attr("class", isEco ? "petal-eco" : "petal-soc")
            .attr("d", d => {
                const niveau = d.data.niveau_risque;
                if (niveau === 1) return ""; 
                return d3.arc()
                    .innerRadius(isEco ? rEcoOuter : Math.max(0, rBlue - step * (niveau - 1)))
                    .outerRadius(isEco ? rEcoOuter + step * (niveau - 1) : rBlue)
                    .startAngle(d.startAngle).endAngle(d.endAngle)();
            })
            .attr("fill", d => colorScale(d.data.niveau_risque))
            .attr("stroke", "#ffffff").attr("stroke-width", "2px")
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "#1c2833").attr("stroke-width", "3px");
                tooltip.style("opacity", 1).html(`<strong style="color:#d81b60">${d.data.dimension}</strong><br/><b>Niveau :</b> ${d.data.niveau_risque}/5`);
            })
            .on("mousemove", function(event) {
                const chartPos = document.getElementById("chart").getBoundingClientRect();
                tooltip.style("left", (event.clientX - chartPos.left + 15) + "px").style("top", (event.clientY - chartPos.top + 15) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", "2px");
                tooltip.style("opacity", 0);
            })
            .on("click", function(event, d) {
                d3.selectAll(".petal-eco, .petal-soc").attr("stroke", "#ffffff").attr("stroke-width", "2px");
                d3.select(this).attr("stroke", "#1c2833").attr("stroke-width", "4px");
                
                let gaugePct = (d.data.niveau_risque / 5) * 100;
                let barColor = colorScale(d.data.niveau_risque);

                d3.select("#sidebar-content").html(`
                    <div class="stat-box">
                        <div class="stat-label">Dimension (${d.data.type})</div>
                        <div class="stat-value"><i class="fas fa-icon" style="font-size:20px; margin-right:10px; color:${barColor};">${iconMap[d.data.id]}</i> ${d.data.dimension}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Valeur mesurée (UTT 2026)</div>
                        <div class="stat-value">${d.data.valeur_mesure} <span class="stat-unit">${d.data.unite}</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Cible de soutenabilité</div>
                        <div class="stat-value" style="font-size:16px; color:#7f8c8d;">Objectif : ${d.data.seuil_reference} ${d.data.unite}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Niveau de risque (${d.data.niveau_risque}/5)</div>
                        <div class="gauge-container">
                            <div class="gauge-fill" style="width: ${gaugePct}%; background-color: ${barColor};"></div>
                        </div>
                    </div>
                    <div class="reco-box">
                        <div class="reco-title"><i class="fas fa-lightbulb" style="margin-right:5px;"></i> Plan d'action recommandé</div>
                        <div class="reco-text">${recoMap[d.data.id]}</div>
                    </div>
                `);
            });
    }

    drawPetals(arcsEco, true);
    drawPetals(arcsSoc, false);

    // Frontières nettes
    svg.append("circle").attr("r", rEcoOuter).attr("class", "limit-line");
    svg.append("circle").attr("r", rSocialOuter).attr("class", "limit-line");
    svg.append("circle").attr("r", rBlue).attr("class", "limit-line");

    // 3. INTÉGRATION DES ICÔNES FONTAWESOME DANS LE DONUT
    function drawIcons(arcs, radius, isEco) {
        svg.selectAll(isEco ? ".icon-eco" : ".icon-soc").data(arcs).join("text")
            .attr("class", "fa-icon")
            .attr("transform", d => {
                const angle = (d.startAngle + d.endAngle) / 2;
                const x = Math.sin(angle) * radius;
                const y = -Math.cos(angle) * radius;
                let rot = angle * 180 / Math.PI - 90;
                if (rot > 90 && rot < 270) rot += 180;
                return `translate(${x}, ${y}) rotate(${rot})`;
            })
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .style("fill", isEco ? "#ffffff" : "#2c3e50")
            .style("font-size", isEco ? "16px" : "14px")
            .style("opacity", "0.9")
            .text(d => iconMap[d.data.id]);
    }

    drawIcons(arcsSoc, rBlue + ((rSocialOuter - rBlue) / 2), false);
    drawIcons(arcsEco, rSocialOuter + ((rEcoOuter - rSocialOuter) / 2), true);

    // 4. TEXTE RADIAL (UNIQUEMENT SOCIAL)
    function drawRadialText(arcs, radius, isSocial) {
        svg.selectAll(".abbr-soc").data(arcs).join("text")
            .attr("transform", d => {
                const angle = (d.startAngle + d.endAngle) / 2;
                let rot = angle * 180 / Math.PI - 90;
                const isBottom = rot > 90 && rot < 270;
                const x = Math.sin(angle) * radius;
                const y = -Math.cos(angle) * radius;
                if (isBottom) rot += 180; 
                return `translate(${x}, ${y}) rotate(${rot})`;
            })
            .attr("text-anchor", d => {
                const angle = (d.startAngle + d.endAngle) / 2;
                const rot = angle * 180 / Math.PI - 90;
                const isBottom = rot > 90 && rot < 270;
                return isBottom ? "start" : "end";
            })
            .attr("alignment-baseline", "middle")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#2c3e50")
            .text(d => d.data.dimension.substring(0, 2).toUpperCase());
    }

    drawRadialText(arcsSoc, rBlue - 4, true);

    // 5. LÉGENDE
    const legendGroup = svg.append("g").attr("transform", `translate(${width / 2 - 240}, ${height / 2 - 130})`);
    const legendItems = [
        { color: "#d81b60", label: "Niveau 5 : Risque Critique" },
        { color: "#d32f2f", label: "Niveau 4 : Risque Élevé" },
        { color: "#ef5350", label: "Niveau 3 : Risque Modéré" },
        { color: "#ffcdd2", label: "Niveau 2 : Proche de la cible" },
        { color: "#4CAF50", label: "Niveau 1 : Espace Sûr" }
    ];
    legendGroup.append("text").attr("x", 0).attr("y", -15).attr("class", "label-dark").style("font-size", "12px").text("Échelle de risque :");
    legendItems.forEach((item, index) => {
        legendGroup.append("rect").attr("x", 0).attr("y", index * 22).attr("width", 14).attr("height", 14).attr("fill", item.color).attr("rx", 3);
        legendGroup.append("text").attr("x", 24).attr("y", index * 22 + 11).attr("class", "label-dark").style("text-anchor", "start").style("font-weight", "normal").text(item.label);
    });
});
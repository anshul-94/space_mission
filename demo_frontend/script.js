// ======================================================
// GLOBAL VARIABLES
// ======================================================

let successChart
let yearChart
let countryChart
let probChart
let forecastChart

// Full Page Chart Variables
let successChartFull
let yearChartFull
let countryChartFull
let forecastChartFull

const API = "http://127.0.0.1:8000"

// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

    // --- 1. Navbar Hamburger Events ---
    const hamburger = document.getElementById("hamburger")
    if(hamburger){
        hamburger.addEventListener("click", () => {
            document.getElementById("navLinks").classList.toggle("open")
        })
    }

    // --- 2. Load Common Metadata ---
    await loadMetadata()

    // --- 3. Page Specific Logic ---
    const pageId = document.body.id

    if(pageId === "page-home"){
        await updateDashboard()
        await loadCountryDistribution()
        await loadForecast()

        // Home Dropdowns
        document.getElementById("countryFilter").addEventListener("change", updateDashboard)
        document.getElementById("topSelector").addEventListener("change", loadCountryDistribution)
        document.getElementById("forecastBtn").addEventListener("click", loadForecast)
        
        // ML Prediction Form
        document.getElementById("predictionForm").addEventListener("submit", predictMission)
    }

    if(pageId === "page-mission"){
        await loadMissionSuccessPage()
        document.getElementById("missionCountryFilter").addEventListener("change", loadMissionSuccessPage)
    }

    if(pageId === "page-launch"){
        // Ensure standard load resolves before forecast load
        await loadLaunchTrendPage()
        document.getElementById("launchCountryFilter").addEventListener("change", loadLaunchTrendPage)
    }

    if(pageId === "page-country"){
        await loadCountryPage()
        document.getElementById("countryTopSelector").addEventListener("change", loadCountryPage)
        document.getElementById("countryPageFilter").addEventListener("change", loadCountryPage)
    }

    if(pageId === "page-insights"){
        // Initial load for Insights defaults to All
        await loadInsightsPage()
        document.getElementById("insightsCountryFilter").addEventListener("change", loadInsightsPage)
    }

})


// ======================================================
// COMMON METADATA LOADER
// ======================================================

async function loadMetadata(){
    try{
        const res = await fetch(`${API}/metadata`)
        const data = await res.json()

        const pageId = document.body.id

        if(pageId === "page-home"){
            populateDatalist("companies", data.companies)
            populateDatalist("countries", data.countries)
            populateDatalist("rocketStatus", data.rocket_status)
            populateDropdown("countryFilter", data.countries, "All")
            populateDropdown("forecastCountry", data.countries, "All Countries")
        }

        if(pageId === "page-mission"){
            populateDropdown("missionCountryFilter", data.countries, "All Countries")
        }

        if(pageId === "page-launch"){
            populateDropdown("launchCountryFilter", data.countries, "All Countries")
        }

        if(pageId === "page-insights"){
            populateDropdown("insightsCountryFilter", data.countries, "All Countries")
        }

        if(pageId === "page-country"){
            populateDropdown("countryPageFilter", data.countries, "All Countries")
        }

    }catch(err){
        console.error("Metadata load error", err)
    }
}

function populateDatalist(id, values){
    const list = document.getElementById(id)
    if(!list) return
    list.innerHTML = ""
    values.forEach(v=>{
        const opt = document.createElement("option")
        opt.value = v
        list.appendChild(opt)
    })
}

function populateDropdown(id, values, allLabel="All"){
    const dropdown = document.getElementById(id)
    if(!dropdown) return
    
    // Preserve currently selected value if any
    const currentVal = dropdown.value
    
    dropdown.innerHTML = `<option value='All'>${allLabel}</option>`
    values.forEach(v=>{
        const opt = document.createElement("option")
        opt.value = v
        opt.textContent = v
        dropdown.appendChild(opt)
    })
    
    // Restore selection if it existed
    if(currentVal && values.includes(currentVal)){
        dropdown.value = currentVal
    }
}


// ======================================================
// 1. HOME DASHBOARD LOGIC
// ======================================================

async function updateDashboard(){
    const country = document.getElementById("countryFilter").value
    try{
        const res = await fetch(`${API}/analytics/${country}`)
        const data = await res.json()

        drawSuccessChart(data.success_vs_failure, "successChart")
        drawYearChart(data.launches_per_year, "yearChart")
        loadInsights(country, "insightsList")
        updateKPIs(data, country)
    }catch(err){
        console.error("Dashboard update error", err)
    }
}

async function loadCountryDistribution(){
    const top = document.getElementById("topSelector").value
    try{
        const res = await fetch(`${API}/country-distribution?top=${top}`)
        const data = await res.json()
        drawCountryChart(data, "countryChart")
    }catch(err){
        console.error("Country distribution error", err)
    }
}

function updateKPIs(data, country){
    const sv = data.success_vs_failure
    const total = sv.success + sv.failure
    const rate = total > 0 ? ((sv.success/total)*100).toFixed(1) : 0

    const elTotal = document.getElementById("totalMissions")
    if (elTotal) elTotal.textContent = total
    
    const elRate = document.getElementById("successRate")
    if (elRate) elRate.textContent = rate + "%"

    // Home Page Summary Cards
    const sumTot = document.getElementById("sumTotal")
    if(sumTot) sumTot.textContent = total

    const sumSuc = document.getElementById("sumSuccessRate")
    if(sumSuc) sumSuc.textContent = rate + "%"

    const sumTopC = document.getElementById("sumTopCountry")
    if(sumTopC) sumTopC.textContent = data.top_country || "--"

    const sumTopComp = document.getElementById("sumTopCompany")
    if(sumTopComp) sumTopComp.textContent = data.top_company || "--"
}

async function predictMission(e){
    e.preventDefault()
    const rocketCost = Number(document.getElementById("rocket_cost").value)
    
    const payload = {
        company: document.getElementById("company").value,
        country: document.getElementById("countryInput").value,
        rocket_status: document.getElementById("rocket_status").value,
        launch_year: Number(document.getElementById("launch_year").value),
        launch_month: Number(document.getElementById("launch_month").value),
        rocket_cost: rocketCost
    }

    try{
        const res = await fetch(`${API}/predict-mission`,{
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        })
        const result = await res.json()

        const resDiv = document.getElementById("predictionResult")
        resDiv.style.display = "block"
        resDiv.innerHTML = `
            <strong>Prediction:</strong> ${result.prediction}<br>
            <strong>Probability:</strong> ${(result.probability*100).toFixed(1)}%<br>
            <strong>Rocket Cost:</strong> $${rocketCost} Million
        `

        const successProb = result.probability
        const failProb = 1 - successProb

        if(probChart) probChart.destroy()
        probChart = new Chart(document.getElementById("probChart"), {
            type: "pie",
            data: {
                labels:["Success Prob","Failure Prob"],
                datasets:[{
                    data:[successProb, failProb],
                    backgroundColor:["#34d399","#f87171"],
                    borderWidth: 2,
                    borderColor: "#1e293b"
                }]
            },
            options: { plugins: { legend: { position:"right", labels:{color:"#cbd5e1"} } } }
        })

    }catch(err){
        console.error("Prediction error", err)
    }
}

async function loadForecast(){
    const country = document.getElementById("forecastCountry").value
    try{
        const res = await fetch(`${API}/launch-forecast?country=${country}`)
        const data = await res.json()
        drawForecastChart(data, "forecastChart")
    }catch(err){
        console.error("Forecast error", err)
    }
}


// ======================================================
// 2. MISSION SUCCESS PAGE LOGIC
// ======================================================

async function loadMissionSuccessPage(){
    const filter = document.getElementById("missionCountryFilter")
    const country = filter ? filter.value : "All"
    
    try{
        const res = await fetch(`${API}/analytics/${country}`)
        const data = await res.json()
        
        const sv = data.success_vs_failure
        const total = sv.success + sv.failure
        const rate = total > 0 ? ((sv.success / total) * 100).toFixed(1) : 0
        const failRate = total > 0 ? ((sv.failure / total) * 100).toFixed(1) : 0

        const sCountry = document.getElementById("sumSelectedCountry")
        if(sCountry) sCountry.textContent = country
        const sTotal = document.getElementById("sumTotal")
        if(sTotal) sTotal.textContent = total
        const sRate = document.getElementById("sumSuccessRate")
        if(sRate) sRate.textContent = rate + "%"
        const fRate = document.getElementById("sumFailureRate")
        if(fRate) fRate.textContent = failRate + "%"

        drawSuccessChart(sv, "successChartFull", true, true)
        
    }catch(err){
        console.error("Mission success page error", err)
    }
}


// ======================================================
// 3. LAUNCH TREND PAGE LOGIC
// ======================================================

async function loadLaunchTrendPage(){
    const filter = document.getElementById("launchCountryFilter")
    const country = filter ? filter.value : "All"

    try{
        const res = await fetch(`${API}/analytics/${country}`)
        const data = await res.json()
        
        const sCountry = document.getElementById("sumSelectedCountry")
        if(sCountry) sCountry.textContent = country === "All" ? "All" : country

        drawYearChart(data.launches_per_year, "yearChartFull", true)
    }catch(err){
        console.error("Launch trend page error", err)
    }
}


// ======================================================
// 4. COUNTRY ANALYTICS PAGE LOGIC
// ======================================================

async function loadCountryPage(){
    const filter = document.getElementById("countryTopSelector")
    const top = filter ? filter.value : "5"
    const cFilter = document.getElementById("countryPageFilter")
    const country = cFilter ? cFilter.value : "All"

    try{
        // 1. Load Chart Data (Top N)
        const resDistribution = await fetch(`${API}/country-distribution?top=${top}`)
        const dataDist = await resDistribution.json()
        drawCountryChart(dataDist, "countryChartFull", true)

        // 2. Load Summary Data for Selected Country
        const resAnalytics = await fetch(`${API}/analytics/${country}`)
        const dataAnalytics = await resAnalytics.json()
        const sv = dataAnalytics.success_vs_failure
        const total = sv.success + sv.failure
        const rate = total > 0 ? ((sv.success / total) * 100).toFixed(1) : 0

        const sCountry = document.getElementById("sumSelectedCountry")
        if(sCountry) sCountry.textContent = country
        const sTotal = document.getElementById("sumTotal")
        if(sTotal) sTotal.textContent = total
        const sRate = document.getElementById("sumSuccessRate")
        if(sRate) sRate.textContent = rate + "%"

    }catch(err){
        console.error("Country page error", err)
    }
}


// ======================================================
// 5. INSIGHTS PAGE LOGIC
// ======================================================

async function loadInsightsPage(){
    const filter = document.getElementById("insightsCountryFilter")
    const country = filter ? filter.value : "All"

    try{
        const res = await fetch(`${API}/insights/${country}`)
        const data = await res.json()
        
        // Update Summary Text
        const sumText = document.getElementById("sumInsightsText")
        if(sumText) {
            sumText.textContent = country === "All" 
                ? "Global insights spanning all spacefaring nations." 
                : `Tailored AI insights specifically covering ${country}.`
        }

        const list = document.getElementById("insightsListFull")
        if(!list) return
        list.innerHTML = ""

        if(!data.insights || data.insights.length === 0){
            list.innerHTML = `<li class="insight-item loading-text">No insights found for ${country}.</li>`
            return
        }

        data.insights.forEach((text, i) => {
            const li = document.createElement("li")
            li.className = "insight-item"
            li.innerHTML = `
                <span class="insight-num">${String(i+1).padStart(2,"0")}</span>
                <span class="insight-text">${text}</span>
            `
            list.appendChild(li)
        })

    }catch(err){
        console.error("Insights page error", err)
        const list = document.getElementById("insightsListFull")
        if(list){
            list.innerHTML = `<li class="insight-item loading-text">Failed to load insights. Make sure backend API is running.</li>`
        }
    }
}


// ======================================================
// REUSABLE CHART RENDER LOGIC
// ======================================================

function getChartRef(canvasId){
    if(canvasId === "successChart") return { ref: successChart, setter: (v)=> successChart = v }
    if(canvasId === "yearChart") return { ref: yearChart, setter: (v)=> yearChart = v }
    if(canvasId === "countryChart") return { ref: countryChart, setter: (v)=> countryChart = v }
    if(canvasId === "forecastChart") return { ref: forecastChart, setter: (v)=> forecastChart = v }
    
    if(canvasId === "successChartFull") return { ref: successChartFull, setter: (v)=> successChartFull = v }
    if(canvasId === "yearChartFull") return { ref: yearChartFull, setter: (v)=> yearChartFull = v }
    if(canvasId === "countryChartFull") return { ref: countryChartFull, setter: (v)=> countryChartFull = v }
    
    return null
}

function drawSuccessChart(data, canvasId, isFull=false, showRightLegend=false){
    const wrapper = getChartRef(canvasId)
    if(!wrapper) return
    if(wrapper.ref) wrapper.ref.destroy()

    const ctx = document.getElementById(canvasId)
    if(!ctx) return

    wrapper.setter(new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Success", "Failure"],
            datasets: [{
                data: [data.success, data.failure],
                backgroundColor: ["#34d399", "#f87171"],
                borderWidth: isFull ? 3 : 2,
                borderColor: "#1e293b",
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: showRightLegend ? "right" : "bottom",
                    labels: { color: "#cbd5e1", font: { size: isFull ? 15 : 13 }, padding: 20 }
                }
            }
        }
    }))
}

function drawYearChart(data, canvasId, isFull=false){
    const wrapper = getChartRef(canvasId)
    if(!wrapper) return
    if(wrapper.ref) wrapper.ref.destroy()

    const ctx = document.getElementById(canvasId)
    if(!ctx) return

    const years = Object.keys(data)
    const totalData = years.map(y => data[y].total)
    const successData = years.map(y => data[y].success)
    const failureData = years.map(y => data[y].failure)

    // Calculate default (All Years) summary for Launch Page if isFull
    if(isFull) {
        const grandTotal = totalData.reduce((a,b)=>a+b, 0)
        const grandSuccess = successData.reduce((a,b)=>a+b, 0)
        const grandFailure = failureData.reduce((a,b)=>a+b, 0)
        
        const updateSummary = (tot, suc, fail) => {
            const elTot = document.getElementById("sumTotal")
            const elSuc = document.getElementById("sumSuccess")
            const elFail = document.getElementById("sumFailure")
            if(elTot) elTot.textContent = tot
            if(elSuc) elSuc.textContent = suc
            if(elFail) elFail.textContent = fail
        }

        // Set Default
        updateSummary(grandTotal, grandSuccess, grandFailure)

        // Reset to default when mouse leaves chart area
        ctx.addEventListener("mouseout", () => {
            updateSummary(grandTotal, grandSuccess, grandFailure)
        })

        // Chart.js onHover to update summary
        var customHover = (e, elements) => {
            if(elements && elements.length > 0){
                const index = elements[0].index
                updateSummary(totalData[index], successData[index], failureData[index])
            }
        }
    }

    // Create Gradient for Success
    const canvas = ctx.getContext('2d')
    const successGradient = canvas.createLinearGradient(0, 0, 0, 400)
    successGradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)')
    successGradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)')

    // Create Gradient for Failure
    const failureGradient = canvas.createLinearGradient(0, 0, 0, 400)
    failureGradient.addColorStop(0, 'rgba(248, 113, 113, 0.4)')
    failureGradient.addColorStop(1, 'rgba(248, 113, 113, 0.0)')

    wrapper.setter(new Chart(ctx, {
        type: "line",
        data: {
            labels: years,
            datasets: [
                {
                    label: "Success",
                    data: successData,
                    borderColor: "#34d399",
                    backgroundColor: successGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: "#1e293b",
                    pointBorderColor: "#34d399",
                    pointBorderWidth: 2,
                    pointRadius: isFull ? 4 : 2,
                    pointHoverRadius: isFull ? 7 : 5
                },
                {
                    label: "Failure",
                    data: failureData,
                    borderColor: "#f87171",
                    backgroundColor: failureGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: "#1e293b",
                    pointBorderColor: "#f87171",
                    pointBorderWidth: 2,
                    pointRadius: isFull ? 4 : 2,
                    pointHoverRadius: isFull ? 7 : 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            onHover: isFull ? customHover : null,
            plugins: { 
                legend: { 
                    display: isFull,
                    labels: { color: "#cbd5e1", font: {size: 14} }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => `Year: ${context[0].label}`,
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            return label;
                        },
                        footer: (context) => {
                            const idx = context[0].dataIndex
                            return `Total Missions: ${totalData[idx]}`
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: { 
                    title: { display: true, text: 'Missions', color: "#94a3b8" },
                    ticks: { color: "#94a3b8" }, 
                    grid: { color: "rgba(255,255,255,0.05)" }, 
                    beginAtZero: true 
                }
            }
        }
    }))
}

function drawCountryChart(data, canvasId, isFull=false){
    const wrapper = getChartRef(canvasId)
    if(!wrapper) return
    if(wrapper.ref) wrapper.ref.destroy()
        
    const ctx = document.getElementById(canvasId)
    if(!ctx) return

    wrapper.setter(new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.countries,
            datasets: [{
                label: "Launches",
                data: data.launches,
                backgroundColor: data.countries.map((_,i) => `hsl(${210 + i*15}, 80%, 60%)`),
                borderRadius: 8,
                barPercentage: isFull ? 0.6 : 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true }
            }
        }
    }))
}

function drawForecastChart(data, canvasId){
    const wrapper = getChartRef(canvasId)
    if(!wrapper) return
    if(wrapper.ref) wrapper.ref.destroy()

    const ctx = document.getElementById(canvasId)
    if(!ctx) return

    const historical = data.launches.slice(0, data.split_index)
    const future = data.launches.slice(data.split_index)

    wrapper.setter(new Chart(ctx, {
        type: "line",
        data: {
            labels: data.years,
            datasets: [
                {
                    label: "Historical",
                    data: historical.concat(Array(future.length).fill(null)),
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56,189,248,0.1)",
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3
                },
                {
                    label: "Forecast Prediction",
                    data: Array(historical.length).fill(null).concat(future),
                    borderColor: "#a78bfa",
                    backgroundColor: "rgba(167,139,250,0.1)",
                    fill: true,
                    tension: 0.4,
                    borderDash: [5, 5],
                    borderWidth: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#e2e8f0" } } },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
            }
        }
    }))
}

// ======================================================
// REUSABLE DASHBOARD RENDER LOGIC
// ======================================================

function loadInsights(country, listId){
    fetch(`${API}/insights/${country}`)
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById(listId)
        if(!list) return
        list.innerHTML = ""
        data.insights.forEach(text => {
            const li = document.createElement("li")
            li.textContent = text
            list.appendChild(li)
        })
    })
    .catch(err => console.error("Insights error", err))
}

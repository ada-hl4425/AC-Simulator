// ==========================================
// ATMOSPHERIC CHEMISTRY SIMULATOR
// Core Engine with Chemical Mechanism
// ==========================================

console.log('🌍 Atmospheric Chemistry Simulator initializing...');

// Physical Constants
const R = 8.314; // Gas constant J/(mol·K)
const NA = 6.022e23; // Avogadro's number
const M_AIR = 28.97; // Molar mass of air g/mol

// Species Configuration
const SPECIES = {
    CH4: { name: 'CH₄', color: '#3b82f6', initial: 1800 }, // ppb
    CO: { name: 'CO', color: '#f59e0b', initial: 100 },
    CO2: { name: 'CO₂', color: '#10b981', initial: 400000 }, // Actually ppm, but in ppb units
    OH: { name: 'OH', color: '#ec4899', initial: 0.1 },
    HO2: { name: 'HO₂', color: '#06b6d4', initial: 10 },
    O3: { name: 'O₃', color: '#8b5cf6', initial: 40 },
    NO: { name: 'NO', color: '#ef4444', initial: 0.5 },
    NO2: { name: 'NO₂', color: '#f97316', initial: 0.5 },
    CH3O2: { name: 'CH₃O₂', color: '#84cc16', initial: 0.01 },
    CH2O: { name: 'CH₂O', color: '#14b8a6', initial: 1 }
};

// Global State
let state = {
    concentrations: {},
    time: 0, // seconds
    temperature: 298, // K
    pressure: 1000, // hPa
    solarZenithAngle: 0, // degrees
    isRunning: false,
    diurnalCycle: true,
    emissions: {
        CH4: 10, // ppb/day
        CO: 5
    },
    noxLevel: 1.0
};

let timeSeriesData = {
    time: [],
    concentrations: {}
};

// Chart instances
let concentrationChart = null;

// Canvas for network visualization
let networkCanvas, networkCtx;

// Initialize concentrations
function initializeConcentrations(preset = 'background') {
    const presets = {
        background: {
            CH4: 1800, CO: 100, CO2: 400000, OH: 0.1, HO2: 10,
            O3: 40, NO: 0.5, NO2: 0.5, CH3O2: 0.01, CH2O: 1
        },
        polluted: {
            CH4: 2000, CO: 500, CO2: 450000, OH: 0.05, HO2: 20,
            O3: 80, NO: 5, NO2: 10, CH3O2: 0.1, CH2O: 5
        },
        clean: {
            CH4: 1750, CO: 50, CO2: 400000, OH: 0.2, HO2: 5,
            O3: 30, NO: 0.1, NO2: 0.1, CH3O2: 0.005, CH2O: 0.5
        }
    };
    
    const initialValues = presets[preset] || presets.background;
    
    Object.keys(SPECIES).forEach(sp => {
        state.concentrations[sp] = initialValues[sp];
        if (!timeSeriesData.concentrations[sp]) {
            timeSeriesData.concentrations[sp] = [];
        }
    });
}

// ==========================================
// CHEMICAL KINETICS
// ==========================================

// Arrhenius equation: k = A * exp(-Ea/RT)
function arrhenius(A, Ea, T) {
    return A * Math.exp(-Ea / (R * T));
}

// Calculate photolysis rate (J-value)
function calculateJValue(reaction, sza) {
    // sza in degrees
    const szaRad = sza * Math.PI / 180;
    const cosSza = Math.max(0, Math.cos(szaRad));
    
    // Simple parameterization: J = J0 * cos(sza)^n
    const jValues = {
        'NO2_photolysis': { j0: 8e-3, n: 1.0 },
        'O3_to_O1D': { j0: 3e-5, n: 1.5 },
        'CH2O_photolysis': { j0: 5e-5, n: 1.2 }
    };
    
    const params = jValues[reaction];
    if (!params) return 0;
    
    return params.j0 * Math.pow(cosSza, params.n);
}

// Reaction rate calculator
function getRateConstant(reactionName, T, P, sza) {
    const kb = 1.381e-23; // Boltzmann constant
    const M = P * 100 / (kb * T) * 1e-6; // Air density in molecules/cm³
    
    const rates = {
        // OH + CH4 → CH3 + H2O
        'CH4_OH': arrhenius(2.45e-12, -1775, T),
        
        // CH3 + O2 → CH3O2
        'CH3_O2': 1e-12,
        
        // CH3O2 + NO → CH2O + NO2 + HO2
        'CH3O2_NO': 2.8e-12,
        
        // CH2O + OH → CO + H2O + HO2
        'CH2O_OH': 5.5e-12,
        
        // CH2O + hν → CO + H2
        'CH2O_photolysis': calculateJValue('CH2O_photolysis', sza),
        
        // CO + OH → CO2 + H
        'CO_OH': arrhenius(1.5e-13, 0, T) * (1 + 0.6 * P / 1013),
        
        // NO + O3 → NO2 + O2
        'NO_O3': arrhenius(3.0e-12, 1500, T),
        
        // NO2 + hν → NO + O
        'NO2_photolysis': calculateJValue('NO2_photolysis', sza),
        
        // NO2 + OH → HNO3
        'NO2_OH': arrhenius(1.2e-11, 0, T),
        
        // HO2 + NO → OH + NO2
        'HO2_NO': arrhenius(3.5e-12, -250, T),
        
        // O + O2 + M → O3 + M
        'O_O2_M': 6e-34 * Math.pow(T / 300, -2.4) * M,
        
        // O3 + hν → O(1D) + O2
        'O3_photolysis': calculateJValue('O3_to_O1D', sza),
        
        // O(1D) + H2O → 2OH
        'O1D_H2O': 1.63e-10,
        
        // OH + HO2 → H2O + O2
        'OH_HO2': 4.8e-11,
        
        // HO2 + HO2 → H2O2 + O2
        'HO2_HO2': 2.3e-13
    };
    
    return rates[reactionName] || 0;
}

// ==========================================
// CHEMICAL MECHANISM (ODEs)
// ==========================================

function calculateRates(c, T, P, sza) {
    // c = concentrations in ppb
    // Convert to molecules/cm³ for kinetics
    const ppbToMolec = P * 100 / (R * T) * NA * 1e-9 * 1e-6;
    
    // Get rate constants
    const k = {};
    Object.keys({
        CH4_OH: 1, CH3_O2: 1, CH3O2_NO: 1, CH2O_OH: 1, CH2O_photolysis: 1,
        CO_OH: 1, NO_O3: 1, NO2_photolysis: 1, NO2_OH: 1, HO2_NO: 1,
        O_O2_M: 1, O3_photolysis: 1, O1D_H2O: 1, OH_HO2: 1, HO2_HO2: 1
    }).forEach(rxn => {
        k[rxn] = getRateConstant(rxn, T, P, sza);
    });
    
    // Rates of change (ppb/s)
    const dcdt = {};
    
    // CH4 loss and production
    dcdt.CH4 = -k.CH4_OH * c.CH4 * c.OH;
    
    // CH3O2 production and loss
    dcdt.CH3O2 = k.CH4_OH * c.CH4 * c.OH - k.CH3O2_NO * c.CH3O2 * c.NO;
    
    // CH2O production and loss
    dcdt.CH2O = k.CH3O2_NO * c.CH3O2 * c.NO 
                - k.CH2O_OH * c.CH2O * c.OH 
                - k.CH2O_photolysis * c.CH2O;
    
    // CO production and loss
    dcdt.CO = k.CH2O_OH * c.CH2O * c.OH 
              + k.CH2O_photolysis * c.CH2O 
              - k.CO_OH * c.CO * c.OH;
    
    // CO2 production
    dcdt.CO2 = k.CO_OH * c.CO * c.OH;
    
    // OH production and loss
    dcdt.OH = 2 * k.O3_photolysis * c.O3 * 0.2 // O(1D) + H2O, assuming 20% H2O quenching
              + k.HO2_NO * c.HO2 * c.NO
              - k.CH4_OH * c.CH4 * c.OH
              - k.CH2O_OH * c.CH2O * c.OH
              - k.CO_OH * c.CO * c.OH
              - k.NO2_OH * c.NO2 * c.OH
              - k.OH_HO2 * c.OH * c.HO2;
    
    // HO2 production and loss
    dcdt.HO2 = k.CH3O2_NO * c.CH3O2 * c.NO
               + k.CH2O_OH * c.CH2O * c.OH
               - k.HO2_NO * c.HO2 * c.NO
               - k.OH_HO2 * c.OH * c.HO2
               - k.HO2_HO2 * c.HO2 * c.HO2;
    
    // NO production and loss
    dcdt.NO = k.NO2_photolysis * c.NO2
              - k.NO_O3 * c.NO * c.O3
              - k.CH3O2_NO * c.CH3O2 * c.NO
              - k.HO2_NO * c.HO2 * c.NO;
    
    // NO2 production and loss
    dcdt.NO2 = k.NO_O3 * c.NO * c.O3
               + k.CH3O2_NO * c.CH3O2 * c.NO
               + k.HO2_NO * c.HO2 * c.NO
               - k.NO2_photolysis * c.NO2
               - k.NO2_OH * c.NO2 * c.OH;
    
    // O3 production and loss
    dcdt.O3 = k.NO2_photolysis * c.NO2
              - k.NO_O3 * c.NO * c.O3
              - k.O3_photolysis * c.O3;
    
    return dcdt;
}

// ==========================================
// NUMERICAL SOLVER (RK4)
// ==========================================

function rk4Step(c, dt, T, P, sza, emissions) {
    // Runge-Kutta 4th order
    
    function addEmissions(dcdt, dt) {
        // Add emissions (ppb/day → ppb/s)
        dcdt.CH4 += emissions.CH4 / 86400;
        dcdt.CO += emissions.CO / 86400;
        return dcdt;
    }
    
    // k1
    let k1 = calculateRates(c, T, P, sza);
    k1 = addEmissions(k1, dt);
    
    // k2
    const c2 = {};
    Object.keys(c).forEach(sp => {
        c2[sp] = Math.max(0, c[sp] + 0.5 * dt * k1[sp]);
    });
    let k2 = calculateRates(c2, T, P, sza);
    k2 = addEmissions(k2, dt);
    
    // k3
    const c3 = {};
    Object.keys(c).forEach(sp => {
        c3[sp] = Math.max(0, c[sp] + 0.5 * dt * k2[sp]);
    });
    let k3 = calculateRates(c3, T, P, sza);
    k3 = addEmissions(k3, dt);
    
    // k4
    const c4 = {};
    Object.keys(c).forEach(sp => {
        c4[sp] = Math.max(0, c[sp] + dt * k3[sp]);
    });
    let k4 = calculateRates(c4, T, P, sza);
    k4 = addEmissions(k4, dt);
    
    // Update
    const cNew = {};
    Object.keys(c).forEach(sp => {
        cNew[sp] = Math.max(0, c[sp] + dt / 6 * (k1[sp] + 2*k2[sp] + 2*k3[sp] + k4[sp]));
    });
    
    return cNew;
}

// ==========================================
// SIMULATION CONTROL
// ==========================================

let animationFrameId = null;
let lastUpdateTime = Date.now();
let simSpeedFactor = 1.0;
let timeStepSize = 60; // seconds

function updateDiurnalCycle() {
    if (!state.diurnalCycle) return;
    
    // Convert simulated time to hours
    const hours = (state.time / 3600) % 24;
    
    // Solar zenith angle simple model
    // SZA = 0 at noon, 90 at sunrise/sunset
    const sza = Math.abs(12 - hours) * 7.5; // Simplified
    state.solarZenithAngle = Math.min(90, sza);
}

function stepSimulation(dt) {
    // Update concentrations
    state.concentrations = rk4Step(
        state.concentrations,
        dt,
        state.temperature,
        state.pressure,
        state.solarZenithAngle,
        state.emissions
    );
    
    // Update time
    state.time += dt;
    
    // Update diurnal cycle
    updateDiurnalCycle();
    
    // Store data (every 10 time steps to reduce memory)
    if (timeSeriesData.time.length === 0 || 
        state.time - timeSeriesData.time[timeSeriesData.time.length - 1] >= dt * 10) {
        timeSeriesData.time.push(state.time);
        Object.keys(SPECIES).forEach(sp => {
            timeSeriesData.concentrations[sp].push(state.concentrations[sp]);
        });
    }
}

function runSimulation() {
    if (!state.isRunning) return;
    
    const currentTime = Date.now();
    const elapsed = (currentTime - lastUpdateTime) / 1000 * simSpeedFactor;
    lastUpdateTime = currentTime;
    
    // Take multiple small steps for stability
    const numSteps = Math.max(1, Math.floor(elapsed / timeStepSize));
    for (let i = 0; i < numSteps; i++) {
        stepSimulation(timeStepSize);
    }
    
    // Update UI
    updateUI();
    
    animationFrameId = requestAnimationFrame(runSimulation);
}

function startSimulation() {
    if (state.isRunning) return;
    state.isRunning = true;
    lastUpdateTime = Date.now();
    runSimulation();
    updateButtons();
}

function pauseSimulation() {
    state.isRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    updateButtons();
}

function resetSimulation() {
    pauseSimulation();
    state.time = 0;
    state.solarZenithAngle = 0;
    timeSeriesData.time = [];
    Object.keys(SPECIES).forEach(sp => {
        timeSeriesData.concentrations[sp] = [];
    });
    initializeConcentrations('background');
    updateUI();
    updateChart();
}

// ==========================================
// UI UPDATES
// ==========================================

function updateUI() {
    // Update time display
    const hours = state.time / 3600;
    document.getElementById('simulatedTime').textContent = hours.toFixed(2) + ' hours';
    
    const localHours = (hours % 24).toFixed(0).padStart(2, '0');
    const localMinutes = ((hours % 1) * 60).toFixed(0).padStart(2, '0');
    document.getElementById('localTime').textContent = `${localHours}:${localMinutes}`;
    
    // Update sun status
    const isDaytime = state.solarZenithAngle < 90;
    document.getElementById('sunIcon').textContent = isDaytime ? '☀️' : '🌙';
    document.getElementById('sunStatus').textContent = isDaytime ? 'Daytime' : 'Nighttime';
    document.getElementById('sza').textContent = state.solarZenithAngle.toFixed(1);
    
    // Update current concentrations
    updateCurrentConcentrations();
    
    // Update chart periodically
    if (timeSeriesData.time.length % 5 === 0) {
        updateChart();
    }
    
    // Update network visualization
    updateNetworkVisualization();
}

function updateCurrentConcentrations() {
    const container = document.getElementById('currentConcentrations');
    container.innerHTML = '';
    
    Object.keys(SPECIES).forEach(sp => {
        const item = document.createElement('div');
        item.className = 'species-item';
        item.style.borderLeftColor = SPECIES[sp].color;
        
        const name = document.createElement('span');
        name.className = 'species-name';
        name.textContent = SPECIES[sp].name;
        
        const value = document.createElement('span');
        value.className = 'species-value';
        const conc = state.concentrations[sp];
        value.textContent = conc < 0.01 ? conc.toExponential(2) : conc.toFixed(2);
        
        item.appendChild(name);
        item.appendChild(value);
        container.appendChild(item);
    });
}

function updateButtons() {
    document.getElementById('runBtn').disabled = state.isRunning;
    document.getElementById('pauseBtn').disabled = !state.isRunning;
}

// Initialize
console.log('Setting up UI...');
initializeConcentrations('background');
setupControls();
setupChart();
setupNetworkCanvas();
updateUI();
updateChart();
console.log('✅ Simulator ready!');

// ==========================================
// CONTROLS SETUP
// ==========================================

function setupControls() {
    // Run/Pause/Reset buttons
    document.getElementById('runBtn').addEventListener('click', startSimulation);
    document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    
    // Simulation speed
    const speedSlider = document.getElementById('simSpeed');
    speedSlider.addEventListener('input', (e) => {
        simSpeedFactor = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = simSpeedFactor.toFixed(1) + 'x';
    });
    
    // Time step
    const dtSlider = document.getElementById('timeStep');
    dtSlider.addEventListener('input', (e) => {
        timeStepSize = parseFloat(e.target.value);
        document.getElementById('dtValue').textContent = timeStepSize.toFixed(0);
    });
    
    // Temperature
    const tempSlider = document.getElementById('temperature');
    tempSlider.addEventListener('input', (e) => {
        state.temperature = parseFloat(e.target.value);
        document.getElementById('tempValue').textContent = state.temperature.toFixed(0);
    });
    
    // Pressure
    const pressureSlider = document.getElementById('pressure');
    pressureSlider.addEventListener('input', (e) => {
        state.pressure = parseFloat(e.target.value);
        document.getElementById('pressureValue').textContent = state.pressure.toFixed(0);
    });
    
    // Solar zenith angle
    const szaSlider = document.getElementById('solarZenith');
    szaSlider.addEventListener('input', (e) => {
        if (!state.diurnalCycle) {
            state.solarZenithAngle = parseFloat(e.target.value);
        }
    });
    
    // Diurnal cycle toggle
    const diurnalCheck = document.getElementById('diurnalCycle');
    diurnalCheck.addEventListener('change', (e) => {
        state.diurnalCycle = e.target.checked;
        document.getElementById('solarZenith').disabled = e.target.checked;
    });
    
    // CH4 emission
    const ch4EmissionSlider = document.getElementById('ch4Emission');
    ch4EmissionSlider.addEventListener('input', (e) => {
        state.emissions.CH4 = parseFloat(e.target.value);
        document.getElementById('ch4EmissionValue').textContent = state.emissions.CH4.toFixed(1);
    });
    
    // CO emission
    const coEmissionSlider = document.getElementById('coEmission');
    coEmissionSlider.addEventListener('input', (e) => {
        state.emissions.CO = parseFloat(e.target.value);
        document.getElementById('coEmissionValue').textContent = state.emissions.CO.toFixed(1);
    });
    
    // NOx level
    const noxSlider = document.getElementById('noxLevel');
    noxSlider.addEventListener('input', (e) => {
        state.noxLevel = parseFloat(e.target.value);
        document.getElementById('noxValue').textContent = state.noxLevel.toFixed(1);
        // Adjust NO and NO2 concentrations
        state.concentrations.NO = state.noxLevel * 0.5;
        state.concentrations.NO2 = state.noxLevel * 0.5;
    });
    
    // Preset buttons
    document.getElementById('resetToBackground').addEventListener('click', () => {
        initializeConcentrations('background');
        updateChart();
    });
    
    document.getElementById('resetToPolluted').addEventListener('click', () => {
        initializeConcentrations('polluted');
        updateChart();
    });
    
    document.getElementById('resetToClean').addEventListener('click', () => {
        initializeConcentrations('clean');
        updateChart();
    });
    
    // Chart options
    document.getElementById('logScale').addEventListener('change', updateChart);
    document.getElementById('showAll').addEventListener('change', updateChart);
    
    // Network options
    document.getElementById('showRates').addEventListener('change', updateNetworkVisualization);
    
    // Export buttons
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    document.getElementById('exportImage').addEventListener('click', exportChartImage);
}

// ==========================================
// CHART SETUP AND UPDATE
// ==========================================

function setupChart() {
    const ctx = document.getElementById('concentrationChart').getContext('2d');
    
    const datasets = Object.keys(SPECIES).map(sp => ({
        label: SPECIES[sp].name,
        data: [],
        borderColor: SPECIES[sp].color,
        backgroundColor: SPECIES[sp].color + '20',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
    }));
    
    concentrationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#e2e8f0',
                        usePointStyle: true,
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#e2e8f0',
                    bodyColor: '#e2e8f0',
                    borderColor: '#475569',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (hours)',
                        color: '#94a3b8'
                    },
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#334155'
                    }
                },
                y: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Concentration (ppb)',
                        color: '#94a3b8'
                    },
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#334155'
                    }
                }
            }
        }
    });
}

function updateChart() {
    if (!concentrationChart) return;
    
    const logScale = document.getElementById('logScale').checked;
    const showAll = document.getElementById('showAll').checked;
    
    // Update scale type
    concentrationChart.options.scales.y.type = logScale ? 'logarithmic' : 'linear';
    
    // Update data
    const timeHours = timeSeriesData.time.map(t => t / 3600);
    concentrationChart.data.labels = timeHours;
    
    concentrationChart.data.datasets.forEach((dataset, i) => {
        const sp = Object.keys(SPECIES)[i];
        dataset.data = timeSeriesData.concentrations[sp];
        dataset.hidden = !showAll && (sp === 'CO2' || sp === 'CH4'); // Hide high concentration species
    });
    
    concentrationChart.update('none');
}

// ==========================================
// NETWORK VISUALIZATION
// ==========================================

function setupNetworkCanvas() {
    networkCanvas = document.getElementById('networkCanvas');
    if (!networkCanvas) {
        console.error('Network canvas not found!');
        return;
    }
    
    networkCtx = networkCanvas.getContext('2d');
    
    // Set canvas size based on container
    function resizeNetworkCanvas() {
        const container = networkCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        networkCanvas.width = Math.max(400, rect.width - 40);
        networkCanvas.height = Math.max(300, Math.min(350, window.innerHeight * 0.4));
        updateNetworkVisualization();
    }
    
    resizeNetworkCanvas();
    window.addEventListener('resize', resizeNetworkCanvas);
    
    updateNetworkVisualization();
}

function updateNetworkVisualization() {
    if (!networkCtx) return;
    
    const width = networkCanvas.width;
    const height = networkCanvas.height;
    
    // Clear canvas
    networkCtx.fillStyle = '#0a0f1a';
    networkCtx.fillRect(0, 0, width, height);
    
    // Define node positions (manually for clarity)
    const nodes = {
        CH4: { x: 100, y: 50 },
        CH3O2: { x: 250, y: 50 },
        CH2O: { x: 400, y: 50 },
        CO: { x: 550, y: 50 },
        CO2: { x: 700, y: 50 },
        OH: { x: 200, y: 200 },
        HO2: { x: 400, y: 200 },
        NO: { x: 200, y: 300 },
        NO2: { x: 400, y: 300 },
        O3: { x: 600, y: 200 }
    };
    
    const showRates = document.getElementById('showRates')?.checked ?? true;
    
    // Draw arrows (reactions)
    const arrows = [
        { from: 'CH4', to: 'CH3O2', label: 'OH' },
        { from: 'CH3O2', to: 'CH2O', label: 'NO' },
        { from: 'CH2O', to: 'CO', label: 'OH/hν' },
        { from: 'CO', to: 'CO2', label: 'OH' },
        { from: 'OH', to: 'HO2', label: '' },
        { from: 'HO2', to: 'OH', label: 'NO' },
        { from: 'NO', to: 'NO2', label: 'O₃/HO₂' },
        { from: 'NO2', to: 'NO', label: 'hν' },
        { from: 'NO2', to: 'O3', label: 'hν+O₂' },
        { from: 'O3', to: 'OH', label: 'hν+H₂O' }
    ];
    
    arrows.forEach(arrow => {
        const from = nodes[arrow.from];
        const to = nodes[arrow.to];
        
        if (!from || !to) return;
        
        drawArrow(networkCtx, from.x, from.y, to.x, to.y, '#475569', arrow.label);
    });
    
    // Draw nodes
    Object.keys(nodes).forEach(sp => {
        const node = nodes[sp];
        const conc = state.concentrations[sp] || 0;
        const size = Math.max(15, Math.min(30, Math.log10(conc + 1) * 5));
        
        drawNode(networkCtx, node.x, node.y, size, SPECIES[sp].color, SPECIES[sp].name);
    });
    
    // Update reaction list
    updateReactionList();
}

function drawArrow(ctx, x1, y1, x2, y2, color, label) {
    const headlen = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    // Shorten arrow to not overlap with nodes
    const margin = 35;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const ratio = (dist - margin) / dist;
    
    const newX1 = x1 + dx * (margin / dist);
    const newY1 = y1 + dy * (margin / dist);
    const newX2 = x1 + dx * ratio;
    const newY2 = y1 + dy * ratio;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(newX1, newY1);
    ctx.lineTo(newX2, newY2);
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(newX2, newY2);
    ctx.lineTo(newX2 - headlen * Math.cos(angle - Math.PI / 6),
               newY2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(newX2, newY2);
    ctx.lineTo(newX2 - headlen * Math.cos(angle + Math.PI / 6),
               newY2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
    
    // Label
    if (label) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, (newX1 + newX2) / 2, (newY1 + newY2) / 2 - 5);
    }
}

function drawNode(ctx, x, y, size, color, label) {
    // Draw molecular structures instead of simple circles
    const scale = size;
    const conc = 0; // Will be passed separately in future
    
    ctx.save();
    ctx.translate(x, y);
    
    // Atom colors (CPK scheme)
    const C = '#909090', H = '#ffffff', O = '#ff0d0d', N = '#3050f8';
    const r = scale * 0.4; // atom radius
    const b = scale * 1.0; // bond length
    
    // Draw based on molecule name
    if (label === 'CH₄') {
        // Methane - central C + 4 H
        drawAtom(ctx, 0, 0, r*1.1, C, 'C');
        [[b,0], [-b*0.5,b*0.86], [-b*0.5,-b*0.86]].forEach(([dx,dy]) => {
            drawBond(ctx, 0, 0, dx, dy);
            drawAtom(ctx, dx, dy, r*0.7, H, 'H');
        });
    } else if (label === 'CO') {
        // Carbon monoxide - triple bond
        drawTripleBond(ctx, -b*0.7, 0, b*0.7, 0);
        drawAtom(ctx, -b*0.7, 0, r, C, 'C');
        drawAtom(ctx, b*0.7, 0, r, O, 'O');
    } else if (label === 'CO₂') {
        // Carbon dioxide
        drawDoubleBond(ctx, -b, 0, 0, 0);
        drawDoubleBond(ctx, 0, 0, b, 0);
        drawAtom(ctx, -b, 0, r, O, 'O');
        drawAtom(ctx, 0, 0, r, C, 'C');
        drawAtom(ctx, b, 0, r, O, 'O');
    } else if (label === 'OH') {
        // Hydroxyl radical
        drawBond(ctx, -b*0.5, 0, b*0.5, 0);
        drawAtom(ctx, -b*0.5, 0, r, O, 'O');
        drawAtom(ctx, b*0.5, 0, r*0.7, H, 'H');
        drawRadical(ctx, b*0.8, -r*0.7);
    } else if (label === 'HO₂') {
        // Hydroperoxyl
        drawBond(ctx, -b*0.7, 0, 0, 0);
        drawBond(ctx, 0, 0, b*0.7, 0);
        drawAtom(ctx, -b*0.7, 0, r*0.7, H, 'H');
        drawAtom(ctx, 0, 0, r, O, 'O');
        drawAtom(ctx, b*0.7, 0, r, O, 'O');
        drawRadical(ctx, b*1.0, -r*0.6);
    } else if (label === 'O₃') {
        // Ozone - bent
        const a = Math.PI/6.5;
        drawBond(ctx, 0, 0, b*Math.cos(a), -b*Math.sin(a));
        drawBond(ctx, 0, 0, b*Math.cos(a), b*Math.sin(a));
        drawAtom(ctx, 0, 0, r, O, 'O');
        drawAtom(ctx, b*Math.cos(a), -b*Math.sin(a), r, O, 'O');
        drawAtom(ctx, b*Math.cos(a), b*Math.sin(a), r, O, 'O');
    } else if (label === 'NO') {
        // Nitric oxide
        drawDoubleBond(ctx, -b*0.6, 0, b*0.6, 0);
        drawAtom(ctx, -b*0.6, 0, r, N, 'N');
        drawAtom(ctx, b*0.6, 0, r, O, 'O');
    } else if (label === 'NO₂') {
        // Nitrogen dioxide - bent
        const a = Math.PI/6;
        drawBond(ctx, 0, 0, b*Math.cos(a), -b*Math.sin(a), 1.5);
        drawBond(ctx, 0, 0, b*Math.cos(a), b*Math.sin(a), 1.5);
        drawAtom(ctx, 0, 0, r, N, 'N');
        drawAtom(ctx, b*Math.cos(a), -b*Math.sin(a), r, O, 'O');
        drawAtom(ctx, b*Math.cos(a), b*Math.sin(a), r, O, 'O');
    } else if (label === 'CH₂O') {
        // Formaldehyde
        drawDoubleBond(ctx, 0, -b*0.6, 0, b*0.4);
        drawBond(ctx, 0, -b*0.6, -b*0.5, -b*1.1);
        drawBond(ctx, 0, -b*0.6, b*0.5, -b*1.1);
        drawAtom(ctx, 0, -b*0.6, r, C, 'C');
        drawAtom(ctx, 0, b*0.4, r, O, 'O');
        drawAtom(ctx, -b*0.5, -b*1.1, r*0.7, H, 'H');
        drawAtom(ctx, b*0.5, -b*1.1, r*0.7, H, 'H');
    } else if (label === 'CH₃O₂') {
        // Methylperoxy
        drawAtom(ctx, -b*0.8, 0, r, C, 'C');
        drawBond(ctx, -b*0.8, 0, 0, 0);
        drawAtom(ctx, 0, 0, r, O, 'O');
        drawBond(ctx, 0, 0, b*0.7, 0);
        drawAtom(ctx, b*0.7, 0, r, O, 'O');
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CH₃', -b*0.8, -r*1.8);
        drawRadical(ctx, b*1.0, -r*0.6);
    } else {
        // Fallback: simple circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
    }
    
    ctx.restore();
}

// Helper: draw atom sphere
function drawAtom(ctx, x, y, radius, color, lbl) {
    const grad = ctx.createRadialGradient(x-radius*0.3, y-radius*0.3, radius*0.1, x, y, radius);
    grad.addColorStop(0, lightenHex(color, 60));
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, darkenHex(color, 30));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = darkenHex(color, 40);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    if (lbl && radius > 3) {
        ctx.fillStyle = radius > 5 ? '#000' : '#fff';
        ctx.font = `bold ${Math.max(7, radius*1.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(lbl, x, y);
        ctx.shadowBlur = 0;
    }
}

// Helper: draw bond
function drawBond(ctx, x1, y1, x2, y2, w=2) {
    ctx.strokeStyle = '#555';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// Helper: double bond
function drawDoubleBond(ctx, x1, y1, x2, y2) {
    const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
    const ox=-dy/len*2, oy=dx/len*2;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1+ox, y1+oy);
    ctx.lineTo(x2+ox, y2+oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1-ox, y1-oy);
    ctx.lineTo(x2-ox, y2-oy);
    ctx.stroke();
}

// Helper: triple bond
function drawTripleBond(ctx, x1, y1, x2, y2) {
    const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
    const ox=-dy/len*2.5, oy=dx/len*2.5;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    [0, ox, -ox].forEach((offX, i) => {
        const offY = i===0 ? 0 : (i===1 ? oy : -oy);
        ctx.beginPath();
        ctx.moveTo(x1+offX, y1+offY);
        ctx.lineTo(x2+offX, y2+offY);
        ctx.stroke();
    });
}

// Helper: radical dot
function drawRadical(ctx, x, y) {
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#aa0000';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// Helper: lighten hex color
function lightenHex(hex, pct) {
    const num = parseInt(hex.replace('#',''), 16);
    const amt = Math.round(2.55*pct);
    const R = Math.min(255, (num>>16)+amt);
    const G = Math.min(255, ((num>>8)&0xFF)+amt);
    const B = Math.min(255, (num&0xFF)+amt);
    return '#'+(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1);
}

// Helper: darken hex color
function darkenHex(hex, pct) {
    const num = parseInt(hex.replace('#',''), 16);
    const amt = Math.round(2.55*pct);
    const R = Math.max(0, (num>>16)-amt);
    const G = Math.max(0, ((num>>8)&0xFF)-amt);
    const B = Math.max(0, (num&0xFF)-amt);
    return '#'+(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1);
}

function updateReactionList() {
    const container = document.getElementById('reactionList');
    if (!container) return;
    
    const c = state.concentrations;
    const T = state.temperature;
    const P = state.pressure;
    const sza = state.solarZenithAngle;
    
    const reactions = [
        { eq: 'CH₄ + OH → products', rate: getRateConstant('CH4_OH', T, P, sza) * c.CH4 * c.OH },
        { eq: 'CO + OH → CO₂', rate: getRateConstant('CO_OH', T, P, sza) * c.CO * c.OH },
        { eq: 'NO + O₃ → NO₂', rate: getRateConstant('NO_O3', T, P, sza) * c.NO * c.O3 },
        { eq: 'NO₂ + hν → NO + O', rate: getRateConstant('NO2_photolysis', T, P, sza) * c.NO2 },
        { eq: 'HO₂ + NO → OH + NO₂', rate: getRateConstant('HO2_NO', T, P, sza) * c.HO2 * c.NO }
    ];
    
    container.innerHTML = '';
    reactions.forEach(rxn => {
        const item = document.createElement('div');
        item.className = 'reaction-item';
        
        const eq = document.createElement('span');
        eq.className = 'reaction-equation';
        eq.textContent = rxn.eq;
        
        const rate = document.createElement('span');
        rate.className = 'reaction-rate';
        rate.textContent = rxn.rate.toExponential(2);
        
        item.appendChild(eq);
        item.appendChild(rate);
        container.appendChild(item);
    });
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

function exportToCSV() {
    let csv = 'Time(hours)';
    Object.keys(SPECIES).forEach(sp => {
        csv += ',' + SPECIES[sp].name + '(ppb)';
    });
    csv += '\n';
    
    timeSeriesData.time.forEach((t, i) => {
        csv += (t / 3600).toFixed(4);
        Object.keys(SPECIES).forEach(sp => {
            csv += ',' + timeSeriesData.concentrations[sp][i].toFixed(6);
        });
        csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atmospheric_chemistry_data.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function exportChartImage() {
    const url = concentrationChart.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'concentration_chart.png';
    a.click();
}


# 🌍 Atmospheric Chemistry Simulator

An interactive web-based simulator for tropospheric chemistry, focusing on the CH₄-CO-CO₂ oxidation chain and related photochemical processes.

## 🎯 Purpose

This educational tool demonstrates fundamental atmospheric chemistry concepts:
- Methane oxidation pathway
- OH radical chemistry
- NOₓ-O₃ cycling
- Photochemical processes (J-values)
- Diurnal variations in atmospheric chemistry

Perfect for:
- Understanding atmospheric chemistry mechanisms
- Exploring sensitivity to different parameters
- Visualizing complex chemical cycles
- PhD application demonstrations
- Teaching atmospheric science concepts

## 🔬 Chemical Mechanism

### Key Species (10 total)
- **CH₄** (Methane): Primary pollutant and greenhouse gas
- **CO** (Carbon monoxide): Intermediate oxidation product
- **CO₂** (Carbon dioxide): Final oxidation product
- **OH** (Hydroxyl radical): "Detergent of the atmosphere"
- **HO₂** (Hydroperoxyl radical): Key oxidant
- **O₃** (Ozone): Photochemical oxidant
- **NO / NO₂** (Nitrogen oxides): NOₓ cycle
- **CH₃O₂** (Methylperoxy radical): Methane oxidation intermediate
- **CH₂O** (Formaldehyde): Volatile organic compound

### Main Reaction Pathways

#### 1. Methane Oxidation Chain
```
CH₄ + OH → CH₃ + H₂O
CH₃ + O₂ → CH₃O₂
CH₃O₂ + NO → CH₂O + NO₂ + HO₂
CH₂O + OH → CO + HO₂
CH₂O + hν → CO + H₂
CO + OH → CO₂ + H
```

#### 2. NOₓ-O₃ Cycle
```
NO + O₃ → NO₂ + O₂
NO₂ + hν → NO + O
O + O₂ + M → O₃ + M
```

#### 3. HOₓ Cycling
```
HO₂ + NO → OH + NO₂
O₃ + hν → O(¹D) + O₂
O(¹D) + H₂O → 2OH
```

## 🛠️ Features

### Interactive Controls
- **Environmental Conditions**
  - Temperature (250-320 K)
  - Pressure (500-1013 hPa)
  - Solar zenith angle (0-90°)
  - Diurnal cycle toggle

- **Emissions & Sources**
  - CH₄ emission rate (0-50 ppb/day)
  - CO emission rate (0-20 ppb/day)
  - NOₓ levels (0.1-10 ppb)

- **Simulation Control**
  - Adjustable simulation speed (0.1x - 10x)
  - Variable time step (10-600 s)
  - Run / Pause / Reset

### Visualizations

1. **Concentration Time Series**
   - Real-time plotting of all species
   - Logarithmic or linear scale
   - Toggle individual species
   - Export as PNG

2. **Reaction Network Diagram**
   - Interactive network visualization
   - Node size reflects concentration
   - Shows reaction pathways
   - Displays reaction rates

3. **Current Status Panel**
   - Live concentration values
   - Local solar time
   - Day/night indicator
   - Key reaction rates

### Preset Scenarios
- **Background Atmosphere**: Typical clean conditions
- **Polluted Conditions**: Urban/industrial scenario
- **Clean Marine**: Pristine oceanic environment

## 🧮 Numerical Methods

### ODE Solver
- **Runge-Kutta 4th Order (RK4)**: Classic explicit method
- Adaptive time-stepping for stability
- Positive concentration enforcement

### Rate Constant Calculations
- **Arrhenius equation**: k(T) = A·exp(-Eₐ/RT)
- **Photolysis rates**: J = J₀·cos(SZA)ⁿ
- **Pressure-dependent reactions**: Three-body reactions

### Physical Constants
- Gas constant R = 8.314 J/(mol·K)
- Avogadro's number Nₐ = 6.022×10²³
- Standard atmospheric density calculations

## 📊 Data Export

- **CSV Export**: Full time series data
  - Time stamps (hours)
  - All species concentrations (ppb)
  - Suitable for further analysis in Python/R

- **Chart Image**: PNG export of concentration plots

## 🚀 Quick Start

### Option 1: GitHub Pages
1. Fork/clone this repository
2. Enable GitHub Pages in Settings
3. Visit: `https://yourusername.github.io/atmos-chem-simulator/`

### Option 2: Local
```bash
# Clone repository
git clone https://github.com/yourusername/atmos-chem-simulator.git
cd atmos-chem-simulator

# Open in browser
# Simply open index.html
# OR use local server:
python3 -m http.server 8000
# Visit http://localhost:8000
```

## 📖 How to Use

### Basic Simulation
1. **Start with default settings** (background atmosphere)
2. **Click "Run"** to start the simulation
3. **Observe** how concentrations evolve over time
4. **Adjust parameters** to see effects

### Exploring Different Scenarios

#### Urban Pollution
- Increase CH₄ emission to 30-50 ppb/day
- Increase NOₓ to 5-10 ppb
- Set to "Polluted Conditions" preset
- Observe enhanced O₃ production

#### Clean Conditions
- Reduce emissions to minimum
- Set to "Clean Marine" preset
- Notice slower chemistry
- Lower O₃ levels

#### Diurnal Variations
- Enable "Diurnal Cycle"
- Run for 24-48 hours
- Observe day-night differences
- Note photolysis effects

### Parameter Sensitivity Studies

1. **Temperature Effect**
   - Run simulation at 250K, 298K, and 320K
   - Compare reaction rates
   - Observe Arrhenius behavior

2. **NOₓ Sensitivity**
   - Vary NOₓ from 0.1 to 10 ppb
   - Watch O₃ production change
   - Understand NOₓ-limited vs VOC-limited regimes

3. **Emission Impact**
   - Change CH₄ emissions
   - Track CO and CO₂ buildup
   - Calculate oxidation timescales

## 🎓 Educational Applications

### For Students
- Visualize abstract chemistry concepts
- Understand feedback loops
- Explore parameter sensitivity
- Learn about atmospheric lifetimes

### For Researchers
- Quick mechanism testing
- Qualitative behavior exploration
- Teaching tool for presentations
- Concept demonstration

### For PhD Applications
- Demonstrates understanding of:
  - Atmospheric chemistry
  - Numerical methods (ODE solving)
  - Data visualization
  - Scientific programming
- Shows ability to communicate complex science
- Relevant for atmospheric chemistry groups

## 🔗 Connections to Advanced Topics

### Earth System Modeling
- Simplified version of mechanisms in models like:
  - GEOS-Chem
  - WRF-Chem
  - UKCA (UK Chemistry and Aerosols)
- Foundation for understanding full chemical transport models

### Mars Atmospheric Chemistry
- Same framework applies to Mars with different:
  - Species (CO₂-dominated)
  - Reaction rates (different temperature)
  - Photolysis (different solar spectrum)
  - Pressure (thinner atmosphere)

### Uncertainty Quantification
- Can be extended to:
  - Monte Carlo analysis
  - Sensitivity analysis (Sobol indices)
  - Ensemble simulations
  - Parameter optimization

## 🛠️ Technical Details

### Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ⚠️ Limited (small screen)

### Dependencies
- **Chart.js v4.4.0**: CDN-loaded
- Pure vanilla JavaScript
- No build process required

### Performance
- Efficient RK4 implementation
- Canvas-based network rendering
- Handles hours of simulation time
- Smooth 60 FPS updates

## 📝 Future Enhancements

Potential additions:
- [ ] Aerosol chemistry
- [ ] Stratospheric chemistry
- [ ] Isoprene/terpene chemistry
- [ ] Halogen chemistry
- [ ] Mars atmospheric chemistry mode
- [ ] Parameter optimization tools
- [ ] Comparison with observations
- [ ] 3D visualization

## 🤝 Contributing

This is an educational tool. Contributions welcome for:
- Additional chemical mechanisms
- Improved visualizations
- Bug fixes
- Documentation improvements
- Educational materials

## 📚 References

### Chemical Mechanisms
- **MCM (Master Chemical Mechanism)**: http://mcm.york.ac.uk/
- **GECKO-A**: Explicit mechanism generator
- **JPL Chemical Kinetics**: NASA reaction rate data

### Atmospheric Chemistry Textbooks
- Jacob, D. J. (1999). Introduction to Atmospheric Chemistry
- Seinfeld & Pandis (2016). Atmospheric Chemistry and Physics
- Finlayson-Pitts & Pitts (2000). Chemistry of the Upper and Lower Atmosphere

### Related Models
- **GEOS-Chem**: Global 3D chemical transport model
- **UKCA**: UK Chemistry and Aerosols model
- **WRF-Chem**: Regional chemistry model

## 👤 Author

Built as a demonstration of atmospheric chemistry understanding and scientific programming skills.

Relevant for PhD applications in:
- Atmospheric chemistry
- Earth system modeling
- Environmental science
- Climate science

---

**Live Demo**: [https://ada-hl4425.github.io/AC-Simulator/]

**Questions?** Open an issue or contact via GitHub!

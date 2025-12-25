// ==========================================
// MOLECULAR STRUCTURE VISUALIZATION
// Add this after atmos-script.js
// ==========================================

// Override the drawNode function with molecular structures
window.addEventListener('DOMContentLoaded', function() {
    console.log('Loading molecular structure renderer...');
    
    // Store original function
    const originalUpdateNetwork = window.updateNetworkVisualization;
    
    // Override with better visualization
    window.updateNetworkVisualization = function() {
        if (!networkCtx) return;
        
        const width = networkCanvas.width;
        const height = networkCanvas.height;
        
        // Clear canvas
        networkCtx.fillStyle = '#0a0f1a';
        networkCtx.fillRect(0, 0, width, height);
        
        // Define molecule positions (responsive)
        const molecules = {
            CH4: { x: width * 0.12, y: height * 0.20 },
            CH3O2: { x: width * 0.30, y: height * 0.20 },
            CH2O: { x: width * 0.50, y: height * 0.20 },
            CO: { x: width * 0.70, y: height * 0.20 },
            CO2: { x: width * 0.88, y: height * 0.20 },
            OH: { x: width * 0.25, y: height * 0.55 },
            HO2: { x: width * 0.50, y: height * 0.55 },
            NO: { x: width * 0.20, y: height * 0.85 },
            NO2: { x: width * 0.45, y: height * 0.85 },
            O3: { x: width * 0.75, y: height * 0.55 }
        };
        
        // Draw arrows
        const arrows = [
            { from: 'CH4', to: 'CH3O2', label: 'OH', color: '#ec4899' },
            { from: 'CH3O2', to: 'CH2O', label: 'NO', color: '#ef4444' },
            { from: 'CH2O', to: 'CO', label: 'OH/hν', color: '#f59e0b' },
            { from: 'CO', to: 'CO2', label: 'OH', color: '#10b981' },
            { from: 'HO2', to: 'OH', label: 'NO', color: '#06b6d4' },
            { from: 'NO', to: 'NO2', label: 'O₃', color: '#8b5cf6' },
            { from: 'NO2', to: 'NO', label: 'hν', color: '#f59e0b' },
            { from: 'O3', to: 'OH', label: 'hν', color: '#ec4899' }
        ];
        
        arrows.forEach(arrow => {
            const from = molecules[arrow.from];
            const to = molecules[arrow.to];
            if (!from || !to) return;
            drawReactionArrow(networkCtx, from.x, from.y, to.x, to.y, arrow.color, arrow.label);
        });
        
        // Draw molecules
        Object.keys(molecules).forEach(sp => {
            const pos = molecules[sp];
            const conc = state.concentrations[sp] || 0;
            drawMolecularStructure(networkCtx, sp, pos.x, pos.y, conc);
        });
        
        // Update reaction list
        if (typeof updateReactionList === 'function') {
            updateReactionList();
        }
    };
    
    console.log('✅ Molecular renderer loaded');
});

// Draw molecular structures
function drawMolecularStructure(ctx, name, x, y, concentration) {
    const scale = Math.min(width / 60, 12); // Responsive sizing
    
    ctx.save();
    ctx.translate(x, y);
    
    // Atom colors (CPK coloring)
    const atomColors = {
        C: '#909090',
        H: '#ffffff',
        O: '#ff0d0d',
        N: '#3050f8'
    };
    
    const atomRadius = scale * 0.45;
    const bondLength = scale * 1.3;
    
    switch(name) {
        case 'CH4': // Methane
            drawAtomSphere(ctx, 0, 0, atomRadius * 1.2, atomColors.C, 'C');
            // 4 H atoms in tetrahedral
            const hPositions = [
                {x: bondLength, y: 0},
                {x: -bondLength * 0.5, y: bondLength * 0.866},
                {x: -bondLength * 0.5, y: -bondLength * 0.866},
                {x: 0, y: 0} // back H (smaller)
            ];
            hPositions.forEach((pos, i) => {
                if (i < 3) {
                    drawBondLine(ctx, 0, 0, pos.x, pos.y, '#666');
                    drawAtomSphere(ctx, pos.x, pos.y, atomRadius * 0.75, atomColors.H, 'H');
                }
            });
            break;
            
        case 'CO': // Carbon monoxide
            drawTripleBond(ctx, -bondLength*0.7, 0, bondLength*0.7, 0);
            drawAtomSphere(ctx, -bondLength*0.7, 0, atomRadius, atomColors.C, 'C');
            drawAtomSphere(ctx, bondLength*0.7, 0, atomRadius, atomColors.O, 'O');
            break;
            
        case 'CO2': // Carbon dioxide
            drawDoubleBond(ctx, -bondLength, 0, 0, 0);
            drawDoubleBond(ctx, 0, 0, bondLength, 0);
            drawAtomSphere(ctx, -bondLength, 0, atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, 0, 0, atomRadius, atomColors.C, 'C');
            drawAtomSphere(ctx, bondLength, 0, atomRadius, atomColors.O, 'O');
            break;
            
        case 'OH': // Hydroxyl radical
            drawBondLine(ctx, -bondLength*0.5, 0, bondLength*0.5, 0, '#666');
            drawAtomSphere(ctx, -bondLength*0.5, 0, atomRadius * 1.1, atomColors.O, 'O');
            drawAtomSphere(ctx, bondLength*0.5, 0, atomRadius * 0.7, atomColors.H, 'H');
            // Radical electron (unpaired)
            drawRadicalDot(ctx, bondLength*0.9, -atomRadius*0.7);
            break;
            
        case 'HO2': // Hydroperoxyl
            drawBondLine(ctx, -bondLength*0.7, 0, 0, 0, '#666');
            drawBondLine(ctx, 0, 0, bondLength*0.7, 0, '#666');
            drawAtomSphere(ctx, -bondLength*0.7, 0, atomRadius * 0.7, atomColors.H, 'H');
            drawAtomSphere(ctx, 0, 0, atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, bondLength*0.7, 0, atomRadius, atomColors.O, 'O');
            drawRadicalDot(ctx, bondLength*1.0, -atomRadius*0.6);
            break;
            
        case 'O3': // Ozone
            const o3Angle = Math.PI / 6.5;
            drawBondLine(ctx, 0, 0, bondLength * Math.cos(o3Angle), -bondLength * Math.sin(o3Angle), '#666');
            drawBondLine(ctx, 0, 0, bondLength * Math.cos(o3Angle), bondLength * Math.sin(o3Angle), '#666');
            drawAtomSphere(ctx, 0, 0, atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, bondLength * Math.cos(o3Angle), -bondLength * Math.sin(o3Angle), atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, bondLength * Math.cos(o3Angle), bondLength * Math.sin(o3Angle), atomRadius, atomColors.O, 'O');
            break;
            
        case 'NO': // Nitric oxide
            drawDoubleBond(ctx, -bondLength*0.6, 0, bondLength*0.6, 0);
            drawAtomSphere(ctx, -bondLength*0.6, 0, atomRadius, atomColors.N, 'N');
            drawAtomSphere(ctx, bondLength*0.6, 0, atomRadius, atomColors.O, 'O');
            break;
            
        case 'NO2': // Nitrogen dioxide
            const no2Angle = Math.PI / 6;
            drawBondLine(ctx, 0, 0, bondLength * Math.cos(no2Angle), -bondLength * Math.sin(no2Angle), '#666', 1.5);
            drawBondLine(ctx, 0, 0, bondLength * Math.cos(no2Angle), bondLength * Math.sin(no2Angle), '#666', 1.5);
            drawAtomSphere(ctx, 0, 0, atomRadius, atomColors.N, 'N');
            drawAtomSphere(ctx, bondLength * Math.cos(no2Angle), -bondLength * Math.sin(no2Angle), atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, bondLength * Math.cos(no2Angle), bondLength * Math.sin(no2Angle), atomRadius, atomColors.O, 'O');
            break;
            
        case 'CH2O': // Formaldehyde
            drawDoubleBond(ctx, 0, -bondLength*0.6, 0, bondLength*0.5);
            drawBondLine(ctx, 0, -bondLength*0.6, -bondLength*0.6, -bondLength*1.2, '#666');
            drawBondLine(ctx, 0, -bondLength*0.6, bondLength*0.6, -bondLength*1.2, '#666');
            drawAtomSphere(ctx, 0, -bondLength*0.6, atomRadius, atomColors.C, 'C');
            drawAtomSphere(ctx, 0, bondLength*0.5, atomRadius, atomColors.O, 'O');
            drawAtomSphere(ctx, -bondLength*0.6, -bondLength*1.2, atomRadius * 0.7, atomColors.H, 'H');
            drawAtomSphere(ctx, bondLength*0.6, -bondLength*1.2, atomRadius * 0.7, atomColors.H, 'H');
            break;
            
        case 'CH3O2': // Methylperoxy - simplified
            drawAtomSphere(ctx, -bondLength, 0, atomRadius, atomColors.C, 'C');
            drawBondLine(ctx, -bondLength, 0, 0, 0, '#666');
            drawAtomSphere(ctx, 0, 0, atomRadius, atomColors.O, 'O');
            drawBondLine(ctx, 0, 0, bondLength, 0, '#666');
            drawAtomSphere(ctx, bondLength, 0, atomRadius, atomColors.O, 'O');
            // CH3 label
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('CH₃', -bondLength, -atomRadius*1.8);
            drawRadicalDot(ctx, bondLength*1.2, -atomRadius*0.6);
            break;
    }
    
    // Molecule name
    ctx.fillStyle = SPECIES[name]?.color || '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(SPECIES[name]?.name || name, 0, scale * 3.2);
    
    // Concentration
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    const concText = concentration < 0.01 ? concentration.toExponential(1) : concentration.toFixed(1);
    ctx.fillText(concText, 0, scale * 4.2);
    
    ctx.restore();
}

// Drawing helpers
function drawAtomSphere(ctx, x, y, radius, color, label) {
    // 3D sphere effect
    const gradient = ctx.createRadialGradient(
        x - radius*0.35, y - radius*0.35, radius*0.1,
        x, y, radius
    );
    gradient.addColorStop(0, lightenColorHex(color, 60));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, darkenColorHex(color, 30));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = darkenColorHex(color, 40);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    
    // Label
    if (label && radius > 4) {
        ctx.fillStyle = radius > 6 ? '#000' : '#fff';
        ctx.font = `bold ${Math.max(8, radius * 1.3)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(label, x, y);
        ctx.shadowBlur = 0;
    }
}

function drawBondLine(ctx, x1, y1, x2, y2, color, width = 2.5) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawDoubleBond(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const offsetX = -dy / len * 2.5;
    const offsetY = dx / len * 2.5;
    
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x1 + offsetX, y1 + offsetY);
    ctx.lineTo(x2 + offsetX, y2 + offsetY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x1 - offsetX, y1 - offsetY);
    ctx.lineTo(x2 - offsetX, y2 - offsetY);
    ctx.stroke();
}

function drawTripleBond(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const offsetX = -dy / len * 3;
    const offsetY = dx / len * 3;
    
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    
    // Center
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Top
    ctx.beginPath();
    ctx.moveTo(x1 + offsetX, y1 + offsetY);
    ctx.lineTo(x2 + offsetX, y2 + offsetY);
    ctx.stroke();
    
    // Bottom
    ctx.beginPath();
    ctx.moveTo(x1 - offsetX, y1 - offsetY);
    ctx.lineTo(x2 - offsetX, y2 - offsetY);
    ctx.stroke();
}

function drawRadicalDot(ctx, x, y) {
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aa0000';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawReactionArrow(ctx, x1, y1, x2, y2, color, label) {
    const margin = 25;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist < margin * 2) return;
    
    const ratio = (dist - margin) / dist;
    const newX1 = x1 + dx * (margin / dist);
    const newY1 = y1 + dy * (margin / dist);
    const newX2 = x1 + dx * ratio;
    const newY2 = y1 + dy * ratio;
    
    // Arrow shaft
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(newX1, newY1);
    ctx.lineTo(newX2, newY2);
    ctx.stroke();
    
    // Arrow head
    const headlen = 10;
    const angle = Math.atan2(dy, dx);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(newX2, newY2);
    ctx.lineTo(
        newX2 - headlen * Math.cos(angle - Math.PI / 6),
        newY2 - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        newX2 - headlen * Math.cos(angle + Math.PI / 6),
        newY2 - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    
    // Label
    if (label) {
        ctx.fillStyle = color;
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, (newX1 + newX2) / 2, (newY1 + newY2) / 2 - 3);
    }
}

// Color utilities
function lightenColorHex(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R*0x10000 + G*0x100 + B).toString(16).slice(1);
}

function darkenColorHex(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R*0x10000 + G*0x100 + B).toString(16).slice(1);
}

// =============================================================================
// UTILITÁRIOS DE COR, CICLO SOLAR, SOMBRA E ESTRELA
// =============================================================================

import { ctx } from '../dom.js';
import { state } from '../state.js';

export function lerpColor(c1, c2, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * clamped);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * clamped);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getTimeOfDayState() {
  // 0 = Dia claro (24h), 0.55 = Pôr do sol (11h), 1.0 = Noite urgente (0h)
  if (state.currentAct === 3) {
    const cycle = (Math.sin(state.endlessFlightSeconds * 0.08 - 0.8) + 1) * 0.5;
    return 0.15 + cycle * 0.55;
  }
  return Math.max(0, Math.min(1, (24 - state.clockHours) / 24));
}

export function drawGroundShadow(x, width) {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, state.groundY + 2, width * 0.52, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawStar(targetCtx, cx, cy, spikes, outerR, innerR, fill, stroke) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  targetCtx.beginPath();
  targetCtx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    targetCtx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    targetCtx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  targetCtx.closePath();
  targetCtx.fillStyle = fill;
  targetCtx.fill();
  if (stroke) {
    targetCtx.strokeStyle = stroke;
    targetCtx.lineWidth = 1.6;
    targetCtx.stroke();
  }
}

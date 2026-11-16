// =============================================================================
// MÓDULO ISOLADO DO PERSONAGEM, SKINS, CARRO, JATINHO E PREVIEW DO MENU
// Edite apenas este arquivo para alterar aparência, animações ou veículos do político.
// =============================================================================

import { ctx } from '../dom.js';
import { getPlayerHitbox } from '../gameplay.js';
import { getTimeOfDayState, drawStar } from './utils.js';
import { state, player, upgrades } from '../state.js';
import { mpState } from '../multiplayer.js';

let activeRivalOverride = null;

function getRenderSkin() {
  return activeRivalOverride ? (activeRivalOverride.skin || 'executivo') : state.selectedSkin;
}

export function drawRemoteRivals() {
  if (!mpState.inMatch || !mpState.connected || mpState.rivals.size === 0) return;

  for (const rival of mpState.rivals.values()) {
    const rawX = player.x + ((rival.dist || 0) - state.distanceMeters) * 5.2;
    const clampedLeft = rawX < 46;
    const clampedRight = rawX > state.logicalWidth - 46;
    const rx = Math.max(46, Math.min(state.logicalWidth - 46, rawX));
    const ry = typeof rival.y === 'number' ? rival.y : state.groundY;
    const rAct = rival.act || 1;

    ctx.save();
    ctx.globalAlpha = rival.alive ? 0.62 : 0.28;

    activeRivalOverride = rival;
    try {
      if (rAct === 1) {
        drawRunningPolitician(rx, ry, player.runCycle, ry < state.groundY - 2);
      } else if (rAct === 2) {
        const rPitch = Math.max(-0.25, Math.min(0.25, (rival.vy || 0) * 0.0004));
        drawExecutiveCar(rx, ry, rPitch, player.wheelAngle, true);
      } else {
        const rPitch = Math.max(-0.35, Math.min(0.35, (rival.vy || 0) * 0.0006));
        drawExecutiveJet(rx, ry, rPitch, player.propAngle, player.waveAngle, true);
      }
    } finally {
      activeRivalOverride = null;
    }

    if (rival.shield && rival.alive) {
      ctx.save();
      ctx.translate(rx, ry - (rAct === 1 ? 38 : rAct === 2 ? 22 : 0));
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, rAct === 2 ? 60 : 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Tag de identificação do rival (nome + distância / seta se fora da tela)
    ctx.globalAlpha = rival.alive ? 0.92 : 0.6;
    ctx.font = '800 11px Inter, sans-serif';
    const prefix = clampedLeft ? '◄ ' : '';
    const suffix = clampedRight ? ' ►' : '';
    const statusText = rival.alive ? `${Math.floor(rival.dist || 0)}m` : 'CAIU';
    const label = `${prefix}${rival.name || 'Rival'} · ${statusText}${suffix}`;
    const tw = ctx.measureText(label).width;
    const bw = Math.max(70, tw + 16);
    const bh = 20;
    const bx = Math.max(bw * 0.5 + 8, Math.min(state.logicalWidth - bw * 0.5 - 8, rx));
    const anchorOffset = rAct === 1 ? (rival.duck ? 64 : 96) : rAct === 2 ? 56 : 42;
    const by = Math.max(40, ry - anchorOffset);

    ctx.fillStyle = rival.alive ? 'rgba(15, 23, 42, 0.82)' : 'rgba(127, 29, 29, 0.85)';
    ctx.strokeStyle = rival.alive ? 'rgba(56, 189, 248, 0.7)' : 'rgba(248, 113, 113, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.5, by - bh, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx, by - bh * 0.5);
    ctx.restore();
  }
}

export function drawTransitionProps() {
  if (!state.transitionProp) return;
  if (state.transitionProp.kind === 'parked_car') {
    drawExecutiveCar(state.transitionProp.x, state.groundY, 0, 0, false);
    // Placa luminosa "CARRO DE FUGA ->"
    ctx.save();
    ctx.translate(state.transitionProp.x, state.groundY - 68);
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-64, -15, 128, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CARRO DE FUGA →', 0, -1);
    ctx.restore();
  } else if (state.transitionProp.kind === 'parked_jet') {
    drawExecutiveJet(state.transitionProp.x, state.groundY - 22, -0.06, player.propAngle, 0, false);
    // Portal / placa "AEROPORTO ->"
    ctx.save();
    ctx.translate(state.transitionProp.x, state.groundY - 76);
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-78, -16, 156, 30, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#022c22';
    ctx.font = '900 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✈ AEROPORTO • FUGA', 0, -1);
    ctx.restore();
  }
}

export function drawPlayer() {
  // Efeito de piscar suave quando invulnerável após quebrar escudo, tropeçar ou trocar de ato
  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 18) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.6;
  }

  if (state.currentAct === 1) {
    drawRunningPolitician(player.x, player.y, player.runCycle, player.vy !== 0);
  } else if (state.currentAct === 2) {
    drawExecutiveCar(player.x, player.y, player.pitch, player.wheelAngle, true);
  } else {
    drawExecutiveJet(player.x, player.y, player.pitch, player.propAngle, player.waveAngle, true);
  }

  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 18) % 2 === 0) {
    ctx.restore();
  }

  // Bolha ciano de Escudo de Imunidade em qualquer ato
  if (player.hasShield) {
    const pBox = getPlayerHitbox();
    ctx.save();
    ctx.translate(pBox.cx, pBox.cy);
    const shieldR = state.currentAct === 2 ? 64 : player.slideTimer > 0 ? 44 : 54;
    const shieldGrad = ctx.createRadialGradient(-10, -12, 6, 0, 0, shieldR + 2);
    shieldGrad.addColorStop(0, 'rgba(224, 242, 254, 0.38)');
    shieldGrad.addColorStop(0.7, 'rgba(34, 211, 238, 0.16)');
    shieldGrad.addColorStop(1, 'rgba(6, 182, 212, 0.42)');
    ctx.fillStyle = shieldGrad;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Balão de fala estilo charge sobre o personagem
  if (state.speechTimer > 0 && state.speechText && state.gameState === 'PLAYING') {
    ctx.save();
    ctx.font = '800 11px Inter, sans-serif';
    const textW = ctx.measureText(state.speechText).width;
    const bw = Math.max(86, textW + 22);
    const bh = 25;
    const anchorY = state.currentAct === 1 ? (player.slideTimer > 0 ? player.y - 68 : player.y - 108) : state.currentAct === 2 ? player.y - 56 : player.y - 42;
    const bx = Math.max(bw * 0.5 + 10, player.x + 26);
    const by = Math.max(76, anchorY);

    ctx.globalAlpha = Math.min(1, state.speechTimer * 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.5, by - bh, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    // Pontinha do balão
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - 1);
    ctx.lineTo(bx - 20, by + 7);
    ctx.lineTo(bx - 3, by - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.speechText, bx, by - bh * 0.5);
    ctx.restore();
  }
}

export function getCharacterPalette(skinName = state.selectedSkin) {
  if (skinName === 'stealth') {
    return {
      suitMain: '#111827',
      suitLight: '#1f2937',
      suitBack: '#030712',
      seamTrim: '#38bdf8',
      tieMain: '#7c3aed',
      tieAccent: '#38bdf8',
      pocketSquare: '#38bdf8',
      pinColor: '#a855f7',
      hairTop: '#1e293b',
      hairBottom: '#020617',
      templeColor: '#64748b',
      briefcaseBody: '#0f172a',
      briefcaseEdge: '#334155',
      briefcaseMetal: '#38bdf8'
    };
  }
  if (skinName === 'gold') {
    return {
      suitMain: '#ca8a04',
      suitLight: '#eab308',
      suitBack: '#854d0e',
      seamTrim: '#fef08a',
      tieMain: '#b91c1c',
      tieAccent: '#fde047',
      pocketSquare: '#fef9c3',
      pinColor: '#ffffff',
      hairTop: '#78350f',
      hairBottom: '#451a03',
      templeColor: '#fde047',
      briefcaseBody: '#713f12',
      briefcaseEdge: '#a16207',
      briefcaseMetal: '#fef08a'
    };
  }
  return {
    suitMain: '#0f172a',
    suitLight: '#1e293b',
    suitBack: '#020617',
    seamTrim: '#475569',
    tieMain: '#16a34a',
    tieAccent: '#facc15',
    pocketSquare: '#facc15',
    pinColor: '#facc15',
    hairTop: '#1e293b',
    hairBottom: '#020617',
    templeColor: '#cbd5e1',
    briefcaseBody: '#090d16',
    briefcaseEdge: '#1e293b',
    briefcaseMetal: '#e2e8f0'
  };
}

export function drawCaricatureHeadOn(targetCtx, scale = 1, isJumpingOrBoosting = false, skinName = state.selectedSkin, forceDizzy = false) {
  targetCtx.save();
  targetCtx.scale(scale, scale);

  const pal = getCharacterPalette(skinName);
  const isDizzy = forceDizzy || (targetCtx === ctx && (state.gameState === 'IMPACT' || player.emotionType === 'dizzy'));
  const isUrgent = state.currentAct < 3 && state.clockHours <= 5.0 && state.gameState === 'PLAYING';
  const isShock = !isDizzy && player.emotionType === 'shock';
  const isSmug = !isDizzy && player.emotionType === 'smug';
  const isBlinking = !isDizzy && player.blinkTimer < 0;
  const hairWave = state.gameState === 'PLAYING' ? Math.sin(performance.now() * 0.014) * 1.1 : 0;

  // Pescoço cel-shaded com contorno nanquim e colarinho branco
  targetCtx.fillStyle = '#fdba74';
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.roundRect(-6.5, -9, 13, 12, 4);
  targetCtx.fill();
  targetCtx.stroke();

  // Sombra cel-shaded dura do queixo no pescoço
  targetCtx.fillStyle = '#ea580c';
  targetCtx.globalAlpha = 0.28;
  targetCtx.beginPath();
  targetCtx.ellipse(1, -5.5, 5.5, 2.5, 0, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.globalAlpha = 1;

  // Colarinho social branco e nó da gravata verde-amarela
  targetCtx.fillStyle = '#ffffff';
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 2;
  targetCtx.beginPath();
  targetCtx.moveTo(-7, -2);
  targetCtx.lineTo(-1, 3.5);
  targetCtx.lineTo(1, -1.5);
  targetCtx.lineTo(8, 2);
  targetCtx.lineTo(7, -3.5);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = pal.tieMain;
  targetCtx.beginPath();
  targetCtx.roundRect(1.5, -1.2, 5.4, 5, 1.5);
  targetCtx.fill();
  targetCtx.stroke();

  // Rosto estilo Anime cel-shaded: maxilar anguloso + contorno escuro nanquim
  targetCtx.fillStyle = '#fed7aa';
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 2.6;
  targetCtx.beginPath();
  targetCtx.moveTo(-12.5, -21);
  targetCtx.quadraticCurveTo(-13.5, -34.5, 0.5, -36);
  targetCtx.quadraticCurveTo(15.5, -35.8, 16.5, -20.5);
  targetCtx.lineTo(17.2, -11.5);
  targetCtx.lineTo(13.8, -5);
  targetCtx.quadraticCurveTo(7.8, -2.2, 1.2, -3);
  targetCtx.quadraticCurveTo(-11.2, -3.5, -12.5, -15.5);
  targetCtx.closePath();
  targetCtx.fill();

  // Plano de sombra cel-shaded marcada no maxilar e têmpora (sem blur)
  targetCtx.fillStyle = '#fdba74';
  targetCtx.beginPath();
  targetCtx.moveTo(-12, -16);
  targetCtx.quadraticCurveTo(-8.5, -5.5, 11.8, -6);
  targetCtx.lineTo(13.5, -5);
  targetCtx.quadraticCurveTo(6.5, -2.2, 1.2, -3);
  targetCtx.quadraticCurveTo(-11, -3.5, -12.5, -15.5);
  targetCtx.closePath();
  targetCtx.fill();

  // Borda em nanquim por cima da pele
  targetCtx.beginPath();
  targetCtx.moveTo(-12.5, -21);
  targetCtx.quadraticCurveTo(-13.5, -34.5, 0.5, -36);
  targetCtx.quadraticCurveTo(15.5, -35.8, 16.5, -20.5);
  targetCtx.lineTo(17.2, -11.5);
  targetCtx.lineTo(13.8, -5);
  targetCtx.quadraticCurveTo(7.8, -2.2, 1.2, -3);
  targetCtx.quadraticCurveTo(-11.2, -3.5, -12.5, -15.5);
  targetCtx.closePath();
  targetCtx.stroke();

  // Sombreamento anime na bochecha + vinco de expressão tensa
  targetCtx.fillStyle = 'rgba(244, 63, 94, 0.2)';
  targetCtx.beginPath();
  targetCtx.ellipse(4.8, -12.8, 4.1, 2.2, -0.1, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.strokeStyle = 'rgba(154, 52, 18, 0.45)';
  targetCtx.lineWidth = 1.2;
  targetCtx.beginPath();
  targetCtx.moveTo(11.2, -14.2);
  targetCtx.lineTo(9.2, -11.2);
  targetCtx.stroke();

  // Olheira leve de cansaço quando o prazo aperta (< 5h)
  if (isUrgent) {
    targetCtx.strokeStyle = 'rgba(124, 45, 18, 0.45)';
    targetCtx.lineWidth = 1.3;
    targetCtx.beginPath();
    targetCtx.arc(8, -19.5, 4.8, 0.25, Math.PI - 0.35);
    targetCtx.stroke();
  }

  // Orelha com desenho interno + comunicador na skin Stealth
  targetCtx.fillStyle = '#fdba74';
  targetCtx.strokeStyle = '#0f172a';
  targetCtx.lineWidth = 2.1;
  targetCtx.beginPath();
  targetCtx.ellipse(-12.2, -17, 4.4, 5.2, -0.1, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.strokeStyle = '#c2410c';
  targetCtx.lineWidth = 1.3;
  targetCtx.beginPath();
  targetCtx.arc(-12, -17, 2.1, -Math.PI * 0.6, Math.PI * 0.65);
  targetCtx.stroke();

  if (skinName === 'stealth') {
    // Fone tático + microfone haste
    targetCtx.fillStyle = '#0f172a';
    targetCtx.strokeStyle = '#38bdf8';
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.arc(-12, -17, 3.1, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = '#a855f7';
    targetCtx.beginPath();
    targetCtx.arc(-12, -17, 1.3, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = '#0f172a';
    targetCtx.lineWidth = 1.9;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(-10.5, -14.5);
    targetCtx.quadraticCurveTo(-2, -10.5, 4, -10.5);
    targetCtx.stroke();

    targetCtx.fillStyle = '#38bdf8';
    targetCtx.beginPath();
    targetCtx.arc(4.5, -10.5, 1.6, 0, Math.PI * 2);
    targetCtx.fill();
  }

  // Cabelo estilo Anime penteado para trás com contorno nanquim e mechas grisalhas na lateral
  targetCtx.fillStyle = pal.hairBottom;
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 2.5;
  targetCtx.lineJoin = 'round';
  targetCtx.beginPath();
  targetCtx.moveTo(-13.8, -14);
  targetCtx.quadraticCurveTo(-17.5, -27.5, -10.2, -36);
  targetCtx.quadraticCurveTo(-1, -44.2, 14 + hairWave, -39.5);
  targetCtx.lineTo(19.5 + hairWave, -34.5);
  targetCtx.quadraticCurveTo(14.5 + hairWave * 0.5, -28.5, 9.5, -29.2);
  targetCtx.lineTo(14 + hairWave * 0.3, -25.8);
  targetCtx.quadraticCurveTo(5.5, -26.8, 1.2, -29);
  targetCtx.quadraticCurveTo(-4.5, -27.5, -8.5, -22);
  targetCtx.lineTo(-9.5, -15);
  targetCtx.closePath();
  targetCtx.fill();

  // Camada cel-shaded clara no topo penteado
  targetCtx.fillStyle = pal.hairTop;
  targetCtx.beginPath();
  targetCtx.moveTo(-11.5, -25);
  targetCtx.quadraticCurveTo(-8.5, -37.5, 11.5 + hairWave, -37.2);
  targetCtx.quadraticCurveTo(5, -31.5, -5.5, -28.5);
  targetCtx.closePath();
  targetCtx.fill();

  // Contorno nanquim sobre o cabelo
  targetCtx.beginPath();
  targetCtx.moveTo(-13.8, -14);
  targetCtx.quadraticCurveTo(-17.5, -27.5, -10.2, -36);
  targetCtx.quadraticCurveTo(-1, -44.2, 14 + hairWave, -39.5);
  targetCtx.lineTo(19.5 + hairWave, -34.5);
  targetCtx.quadraticCurveTo(14.5 + hairWave * 0.5, -28.5, 9.5, -29.2);
  targetCtx.lineTo(14 + hairWave * 0.3, -25.8);
  targetCtx.quadraticCurveTo(5.5, -26.8, 1.2, -29);
  targetCtx.quadraticCurveTo(-4.5, -27.5, -8.5, -22);
  targetCtx.lineTo(-9.5, -15);
  targetCtx.closePath();
  targetCtx.stroke();

  // Mechas grisalhas estilizadas na lateral e têmpora (cel-shaded)
  targetCtx.fillStyle = pal.templeColor;
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 1.2;
  targetCtx.beginPath();
  targetCtx.moveTo(-12.5, -19.5);
  targetCtx.quadraticCurveTo(-10.8, -26.5, -4.5, -29.5);
  targetCtx.quadraticCurveTo(-6.2, -23.5, -8.5, -21);
  targetCtx.lineTo(-10.4, -15.5);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = '#e2e8f0';
  targetCtx.beginPath();
  targetCtx.moveTo(-13.2, -25.5);
  targetCtx.quadraticCurveTo(-8.5, -33.2, 1.5, -33.6);
  targetCtx.quadraticCurveTo(-5.5, -29.8, -10.2, -23.5);
  targetCtx.closePath();
  targetCtx.fill();

  // Filete de brilho anime nos fios
  targetCtx.strokeStyle = skinName === 'gold' ? 'rgba(254, 240, 138, 0.8)' : 'rgba(255, 255, 255, 0.38)';
  targetCtx.lineWidth = 1.7;
  targetCtx.lineCap = 'round';
  targetCtx.beginPath();
  targetCtx.moveTo(-3.5, -36.8);
  targetCtx.quadraticCurveTo(5.5, -38.6, 13.5 + hairWave * 0.5, -35.2);
  targetCtx.stroke();

  // Nariz anguloso estilo anime com contorno nanquim
  targetCtx.fillStyle = '#fdba74';
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 2.3;
  targetCtx.beginPath();
  targetCtx.moveTo(14.5, -21.8);
  targetCtx.lineTo(22.2, -16.2);
  targetCtx.lineTo(14.5, -13.2);
  targetCtx.fill();
  targetCtx.stroke();

  // Olhos expressivos, Espiral de Tontura na Queda ou Óculos estilizados por Skin
  if (isDizzy) {
    // Fundo do globo ocular arregalado + espiral giratória (cômico em todas as skins)
    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = '#0f172a';
    targetCtx.lineWidth = 1.9;
    targetCtx.beginPath();
    targetCtx.ellipse(8.2, -20.2, 5.8, 6.2, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.save();
    targetCtx.translate(8.4, -20.2);
    targetCtx.rotate(state.dizzyStarAngle * 2.2);
    targetCtx.strokeStyle = '#0f172a';
    targetCtx.lineWidth = 1.5;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    for (let t = 0; t <= 16; t++) {
      const ang = t * 0.85;
      const r = (t / 16) * 4.6;
      const sx = Math.cos(ang) * r;
      const sy = Math.sin(ang) * r;
      if (t === 0) targetCtx.moveTo(sx, sy);
      else targetCtx.lineTo(sx, sy);
    }
    targetCtx.stroke();
    targetCtx.restore();

    // Sobrancelha torta de tonto
    targetCtx.strokeStyle = '#2e1303';
    targetCtx.lineWidth = 2.4;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(2.6, -28);
    targetCtx.quadraticCurveTo(8, -25.2, 13.5, -29.5);
    targetCtx.stroke();
  } else if (skinName === 'stealth' || skinName === 'gold') {
    // Haste até a orelha
    targetCtx.strokeStyle = skinName === 'gold' ? '#eab308' : '#334155';
    targetCtx.lineWidth = 2.1;
    targetCtx.beginPath();
    targetCtx.moveTo(-10.5, -21.5);
    targetCtx.lineTo(1.5, -22);
    targetCtx.stroke();

    if (skinName === 'stealth') {
      // Visor tático chanfrado com HUD ciano/violeta
      const visorGrad = targetCtx.createLinearGradient(1, -25, 16, -15);
      visorGrad.addColorStop(0, '#0f172a');
      visorGrad.addColorStop(0.55, '#312e81');
      visorGrad.addColorStop(1, '#0284c7');
      targetCtx.fillStyle = visorGrad;
      targetCtx.strokeStyle = '#38bdf8';
      targetCtx.lineWidth = 1.8;
      targetCtx.beginPath();
      targetCtx.moveTo(1, -24.5);
      targetCtx.lineTo(16, -24.5);
      targetCtx.lineTo(15, -16.8);
      targetCtx.quadraticCurveTo(7.5, -15.2, 2, -18.2);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();

      targetCtx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
      targetCtx.lineWidth = 1.5;
      targetCtx.beginPath();
      targetCtx.moveTo(4.5, -22.5);
      targetCtx.lineTo(9.5, -18);
      targetCtx.moveTo(10.5, -22.5);
      targetCtx.lineTo(12.5, -20.5);
      targetCtx.stroke();
    } else {
      // Óculos aviador Gold com armação dourada e lente escura brilhante
      const aviatorGrad = targetCtx.createLinearGradient(1, -25, 16, -14);
      aviatorGrad.addColorStop(0, '#090d16');
      aviatorGrad.addColorStop(0.7, '#27272a');
      aviatorGrad.addColorStop(1, '#713f12');
      targetCtx.fillStyle = aviatorGrad;
      targetCtx.strokeStyle = '#facc15';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(1.5, -24.5);
      targetCtx.lineTo(15.5, -24.2);
      targetCtx.quadraticCurveTo(16.5, -16, 10, -15.2);
      targetCtx.quadraticCurveTo(2.5, -15, 1.5, -21);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();

      // Ponte dupla superior do aviador
      targetCtx.strokeStyle = '#fef08a';
      targetCtx.lineWidth = 1.3;
      targetCtx.beginPath();
      targetCtx.moveTo(1.5, -25.8);
      targetCtx.lineTo(14.5, -25.5);
      targetCtx.stroke();

      // Reflexo diagonal duplo
      targetCtx.strokeStyle = 'rgba(254, 249, 195, 0.85)';
      targetCtx.lineWidth = 1.5;
      targetCtx.beginPath();
      targetCtx.moveTo(4.2, -22.5);
      targetCtx.lineTo(8.5, -17.5);
      targetCtx.moveTo(9.2, -22.5);
      targetCtx.lineTo(11.6, -19.8);
      targetCtx.stroke();
    }
  } else {
    if (isBlinking && !isShock) {
      targetCtx.strokeStyle = '#020617';
      targetCtx.lineWidth = 2.4;
      targetCtx.lineCap = 'round';
      targetCtx.beginPath();
      targetCtx.moveTo(3.5, -20.5);
      targetCtx.quadraticCurveTo(8.5, -18.5, 13, -20.5);
      targetCtx.stroke();
    } else {
      // Olho estilo Anime tenso: esclera nítida, íris concentrada e sobrancelha franzida
      targetCtx.fillStyle = '#ffffff';
      targetCtx.strokeStyle = '#020617';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(3.2, -23.5);
      targetCtx.lineTo(13.2, -21.2);
      targetCtx.quadraticCurveTo(13.5, -16, 8.2, -15.8);
      targetCtx.quadraticCurveTo(3.5, -16.2, 3.2, -23.5);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();

      targetCtx.fillStyle = '#312e81';
      targetCtx.beginPath();
      targetCtx.arc(9.8, -19.8, isShock ? 2.1 : 2.6, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.fillStyle = '#020617';
      targetCtx.beginPath();
      targetCtx.arc(10.1, -19.8, isShock ? 1.1 : 1.5, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.fillStyle = '#ffffff';
      targetCtx.beginPath();
      targetCtx.arc(10.8, -21.0, 1.0, 0, Math.PI * 2);
      targetCtx.fill();
    }

    // Sobrancelha anime tensa e marcada
    targetCtx.strokeStyle = '#020617';
    targetCtx.lineWidth = 2.8;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    if (isShock) {
      targetCtx.moveTo(2.8, -28.2);
      targetCtx.quadraticCurveTo(8, -32, 13.5, -27.5);
    } else if (isSmug) {
      targetCtx.moveTo(3, -27);
      targetCtx.quadraticCurveTo(8.5, -30, 13.5, -26.5);
    } else {
      // Tensão e urgência na fuga (angulada para o centro)
      targetCtx.moveTo(2.8, -28);
      targetCtx.lineTo(9.2, -25.8);
      targetCtx.lineTo(13.8, -23.8);
    }
    targetCtx.stroke();
  }

  // Boca expressiva estilo anime (tensa / cerrando os dentes na corrida)
  targetCtx.strokeStyle = '#020617';
  targetCtx.lineWidth = 1.9;
  if (isDizzy) {
    targetCtx.strokeStyle = '#020617';
    targetCtx.lineWidth = 2;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(2.5, -10.5);
    targetCtx.quadraticCurveTo(5.8, -12.6, 8.8, -9.8);
    targetCtx.quadraticCurveTo(11.6, -7.2, 14.5, -10.2);
    targetCtx.stroke();
    // Língua para fora de tontura
    targetCtx.fillStyle = '#fb7185';
    targetCtx.strokeStyle = '#020617';
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.ellipse(11.4, -7.4, 2.3, 3.0, 0.2, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (isShock || isJumpingOrBoosting) {
    targetCtx.fillStyle = '#7f1d1d';
    targetCtx.beginPath();
    targetCtx.ellipse(8.8, -9.2, isShock ? 5.2 : 4.5, isShock ? 4.4 : 3.3, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.roundRect(5.2, -13, 7, 2.2, 1);
    targetCtx.fill();
    targetCtx.fillStyle = '#fb7185';
    targetCtx.beginPath();
    targetCtx.ellipse(9, -6.8, 2.8, 1.4, 0, 0, Math.PI * 2);
    targetCtx.fill();
  } else if (isSmug) {
    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.moveTo(2, -11);
    targetCtx.quadraticCurveTo(9, -4.5, 14.2, -12.2);
    targetCtx.quadraticCurveTo(8.5, -9.8, 2, -11);
    targetCtx.fill();
    targetCtx.stroke();
  } else {
    // Dentes cerrados de tensão estilo anime
    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.roundRect(3.2, -11.8, 10.6, 4.2, 1.6);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.strokeStyle = '#020617';
    targetCtx.lineWidth = 1.1;
    targetCtx.beginPath();
    targetCtx.moveTo(3.5, -9.7);
    targetCtx.lineTo(13.5, -9.7);
    targetCtx.moveTo(6.8, -11.8);
    targetCtx.lineTo(6.8, -7.6);
    targetCtx.moveTo(10.2, -11.8);
    targetCtx.lineTo(10.2, -7.6);
    targetCtx.stroke();
  }

  // Gota de suor estilo Anime na têmpora (sempre destacada em fuga tensa)
  if (!isDizzy) {
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.strokeStyle = '#020617';
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-4.8, -28);
    targetCtx.quadraticCurveTo(-8.8, -20, -4.8, -17.2);
    targetCtx.quadraticCurveTo(-0.8, -20, -4.8, -28);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.arc(-5.6, -20.5, 1.15, 0, Math.PI * 2);
    targetCtx.fill();

    if (isUrgent || state.gameState === 'PLAYING') {
      targetCtx.strokeStyle = 'rgba(2, 6, 23, 0.45)';
      targetCtx.lineWidth = 1.2;
      targetCtx.beginPath();
      targetCtx.moveTo(0.8, -25.2);
      targetCtx.lineTo(2.4, -22.5);
      targetCtx.stroke();
    }
  }

  targetCtx.restore();
}

export function drawCaricatureHead(scale = 1, isJumpingOrBoosting = false) {
  drawCaricatureHeadOn(ctx, scale, isJumpingOrBoosting, getRenderSkin());
}

export function drawArticulatedLeg(hipAngle, kneeBend, suitColor, isBackLeg) {
  ctx.save();
  ctx.rotate(hipAngle);

  // Coxa afilada
  ctx.fillStyle = suitColor;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.lineTo(5, 16);
  ctx.lineTo(-5, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Joelho + panturrilha + barra da calça
  ctx.translate(0, 13.5);
  ctx.rotate(kneeBend);
  ctx.fillStyle = suitColor;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(4.2, 13.5);
  ctx.lineTo(-4.2, 13.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Vinco de alfaiataria na frente da calça
  if (!isBackLeg) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1.5, 2);
    ctx.lineTo(1.5, 11.5);
    ctx.stroke();
  }

  // Meia social branca aparecendo na canela
  ctx.fillStyle = isBackLeg ? '#cbd5e1' : '#f8fafc';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-3.6, 12.2, 7.2, 3.6, 1);
  ctx.fill();
  ctx.stroke();

  // Sapato Oxford lustrado com salto e sola
  ctx.translate(0, 14.5);
  ctx.fillStyle = isBackLeg ? '#020617' : '#0f172a';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5.2, 0);
  ctx.lineTo(3.5, 0);
  ctx.lineTo(9.5, 1.5);
  ctx.quadraticCurveTo(15.2, 3, 13.5, 6.8);
  ctx.lineTo(-5.2, 6.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sola fina + salto
  ctx.fillStyle = '#334155';
  ctx.fillRect(-5.2, 5.6, 18.2, 1.6);

  // Brilho no bico do sapato
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(8.2, 3.1, 3.1, 1.1, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawRunningPolitician(x, footY, cycle, inAir) {
  ctx.save();
  ctx.translate(x, footY);

  const pal = getCharacterPalette(getRenderSkin());
  const suitMain = pal.suitMain;
  const suitBack = pal.suitBack;
  const tieColor = pal.tieMain;
  const tieStripe = pal.tieAccent;

  const isSliding = activeRivalOverride ? Boolean(activeRivalOverride.duck) : player.slideTimer > 0;
  const stride = Math.sin(cycle);
  const bounce = isSliding ? 2 : inAir ? -6 : Math.abs(Math.cos(cycle)) * -6;
  const bodyLean = isSliding ? -0.92 : inAir ? 0.12 : 0.18 + Math.sin(cycle * 2) * 0.03;
  const flipping = activeRivalOverride ? false : player.isFlipping;

  const frontHip = isSliding ? -1.15 : flipping ? -0.95 : inAir ? -0.55 : stride * 0.78;
  const frontKnee = isSliding ? 0.25 : flipping ? 1.35 : inAir ? 0.85 : Math.max(0.1, -stride * 0.7 + 0.35);
  const backHip = isSliding ? -0.9 : flipping ? -0.65 : inAir ? 0.42 : -stride * 0.78;
  const backKnee = isSliding ? 0.45 : flipping ? 1.25 : inAir ? 0.75 : Math.max(0.1, stride * 0.7 + 0.35);

  const frontArm = isSliding ? 0.75 : flipping ? -1.25 : inAir ? -0.95 : -stride * 0.75;
  const backArm = isSliding ? -0.8 : flipping ? 0.85 : inAir ? 0.55 : stride * 0.75;

  // Sombra suave no chão proporcional à altura
  const heightAboveGround = Math.max(0, state.groundY - footY);
  const shadowScale = Math.max(0.35, 1 - heightAboveGround / 220);
  ctx.save();
  ctx.translate(0, heightAboveGround + 2);
  ctx.scale(shadowScale * (isSliding ? 1.35 : 1), shadowScale);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Squash & Stretch no eixo dos pés
  ctx.scale(activeRivalOverride ? 1 : player.squashX, activeRivalOverride ? 1 : player.squashY);
  ctx.translate(0, isSliding ? 20 + bounce : bounce);

  if (flipping) {
    ctx.translate(0, -36);
    ctx.rotate(player.flipAngle);

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 38, -Math.PI * 0.85, Math.PI * 0.35);
    ctx.stroke();

    ctx.translate(0, 36);
  } else {
    ctx.rotate(bodyLean);
  }

  // 1. BRAÇO TRASEIRO BALANÇANDO (contorno nanquim cel-shaded)
  ctx.save();
  ctx.translate(2, -52);
  ctx.rotate(backArm);
  ctx.fillStyle = suitBack;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-4.5, 0, 9, 20, 4.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3.8, 17, 7.6, 2.5);
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.arc(0, 22, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. ABAS DO PALETÓ ESCURO ABERTO ESVOAÇANDO PARA TRÁS
  const coatFlutter = isSliding ? -0.15 : Math.sin(cycle * 1.4) * 0.16;
  ctx.save();
  ctx.translate(-9, -35);
  ctx.rotate(coatFlutter);
  ctx.fillStyle = suitBack;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(2, -16);
  ctx.lineTo(-14, 9);
  ctx.quadraticCurveTo(-5, 13, 6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. PERNA TRASEIRA ARTICULADA
  ctx.save();
  ctx.translate(-2, -31);
  drawArticulatedLeg(backHip, backKnee, suitBack, true);
  ctx.restore();

  // 4. TRONCO: CAMISA BRANCA VISÍVEL + PALETÓ ESCURO ABERTO + GRAVATA VERDE E AMARELA
  // Camisa social branca cel-shaded no centro do peito
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-10, -56);
  ctx.quadraticCurveTo(2, -60, 13, -55.5);
  ctx.lineTo(14, -30.5);
  ctx.quadraticCurveTo(2, -26.5, -10, -31);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sombra cel-shaded e filete de botões da camisa branca
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-10, -54, 6, 22);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8.5, -52);
  ctx.lineTo(9.2, -31.5);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  for (const by of [-47, -41, -35]) {
    ctx.beginPath();
    ctx.arc(8.8, by, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aba traseira/esquerda aberta do paletó escuro cel-shaded
  ctx.fillStyle = pal.suitLight;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-13, -55);
  ctx.quadraticCurveTo(-5, -58, 3, -56);
  ctx.lineTo(1.5, -28.5);
  ctx.quadraticCurveTo(-7.5, -27, -14.5, -31.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sombra cel-shaded dura na lateral do paletó
  ctx.fillStyle = suitMain;
  ctx.beginPath();
  ctx.moveTo(-13, -54);
  ctx.lineTo(-4, -55);
  ctx.lineTo(-6, -29);
  ctx.lineTo(-14.2, -31.5);
  ctx.closePath();
  ctx.fill();

  // Aba frontal estreita do paletó aberto (mostrando a camisa branca entre as lapelas)
  ctx.fillStyle = suitMain;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(10.5, -56);
  ctx.lineTo(14.5, -55);
  ctx.lineTo(15.2, -31);
  ctx.lineTo(11.5, -31.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const activeSkin = getRenderSkin();
  if (activeSkin === 'stealth' || activeSkin === 'gold') {
    ctx.strokeStyle = pal.seamTrim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, -48);
    ctx.lineTo(-11, -33);
    ctx.stroke();
  }

  // Lapela desenhada do paletó aberto + broche dourado + lenço
  ctx.fillStyle = pal.suitLight;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -56.5);
  ctx.lineTo(4.2, -41.5);
  ctx.lineTo(-3.5, -45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.pinColor;
  ctx.beginPath();
  ctx.arc(-0.5, -46.5, 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.pocketSquare;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-8.5, -42.5);
  ctx.lineTo(-5.5, -46.5);
  ctx.lineTo(-3.2, -42.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // GRAVATA VERDE E AMARELA ESVOAÇANDO PARA TRÁS COM O VENTO (cel-shaded)
  ctx.save();
  ctx.translate(9.5, -55);
  const tieFlutter = Math.sin(cycle * 1.9) * 0.28;
  const tieTipWave = Math.cos(cycle * 2.4) * 3.8;
  ctx.rotate(tieFlutter);
  ctx.fillStyle = tieColor;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-20, -4, -39, 5 + tieTipWave);
  ctx.lineTo(-44, 10 + tieTipWave);
  ctx.lineTo(-33, 14 + tieTipWave);
  ctx.quadraticCurveTo(-15, 5, 2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Listras amarelas diagonais marcadas na gravata verde
  ctx.fillStyle = tieStripe;
  for (const tx of [-10, -21, -32]) {
    ctx.beginPath();
    ctx.moveTo(tx, 0.2);
    ctx.lineTo(tx + 4.2, 0.5);
    ctx.lineTo(tx - 0.5, 7.2);
    ctx.lineTo(tx - 4.7, 6.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 5. PERNA DIANTEIRA ARTICULADA
  ctx.save();
  ctx.translate(2, -31);
  drawArticulatedLeg(frontHip, frontKnee, suitMain, false);
  ctx.restore();

  // 6. CABEÇA EXPRESSIVA ESTILO ANIME
  ctx.save();
  ctx.translate(2, -58.5);
  ctx.rotate(-bodyLean * 0.58);
  drawCaricatureHead(1.06, inAir && !isSliding);
  ctx.restore();

  // 7. BRAÇO DIANTEIRO ARTICULADO + MALETA EXECUTIVA PRETA NA MÃO
  ctx.save();
  ctx.translate(-2, -52);
  ctx.rotate(frontArm);
  ctx.fillStyle = suitMain;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-5, 0, 10, 15, 5);
  ctx.fill();
  ctx.stroke();

  ctx.translate(0, 12);
  ctx.rotate(-0.85 + Math.cos(cycle) * 0.24);
  ctx.fillStyle = suitMain;
  ctx.beginPath();
  ctx.roundRect(-4.5, 0, 9, 13.5, 4);
  ctx.fill();
  ctx.stroke();

  // Punho branco da camisa + relógio
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.6;
  ctx.fillRect(-4, 11.5, 8, 3);
  ctx.strokeRect(-4, 11.5, 8, 3);

  ctx.fillStyle = pal.pinColor;
  ctx.beginPath();
  ctx.roundRect(-4.5, 10.5, 9, 2.2, 1);
  ctx.fill();

  // Maleta Executiva Preta ("24H") firme na mão dianteira
  ctx.save();
  ctx.translate(0.5, 18);
  ctx.rotate(-frontArm * 0.65 + 0.72);
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 1.5, 4.5, Math.PI, 0);
  ctx.stroke();

  ctx.fillStyle = pal.briefcaseBody;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.roundRect(-13.5, 1.5, 27, 18.5, 3.2);
  ctx.fill();
  ctx.stroke();

  // Aba cel-shaded da maleta + fechos metálicos + etiqueta "24H"
  ctx.fillStyle = pal.briefcaseEdge;
  ctx.beginPath();
  ctx.roundRect(-12, 2.5, 24, 6.2, 2);
  ctx.fill();

  ctx.fillStyle = pal.briefcaseMetal;
  ctx.fillRect(-13, 2, 4, 4);
  ctx.fillRect(9, 2, 4, 4);
  ctx.fillRect(-7.5, 7, 3, 3.5);
  ctx.fillRect(4.5, 7, 3, 3.5);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(-5.5, 11.2, 11, 5.4);
  ctx.fillStyle = '#020617';
  ctx.font = '900 4.8px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('24H', 0, 14);
  ctx.restore();

  // Mão segurando a alça da maleta
  ctx.fillStyle = '#fdba74';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0.2, 17, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.ellipse(-2.8, 15.2, 2.1, 1.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export function drawExecutiveCar(x, groundFootY, pitch, wheelAngle, withDriver) {
  ctx.save();
  const carAltitude = Math.max(0, state.groundY - groundFootY);
  const shadowScale = Math.max(0.4, 1 - carAltitude / 240);
  ctx.save();
  ctx.translate(x, state.groundY + 10);
  ctx.scale(shadowScale, 1);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 64, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tod = getTimeOfDayState();
  const roadBounce = carAltitude === 0 ? Math.sin(wheelAngle * 2) * 1.2 : 0;
  const bodySusp = withDriver && !activeRivalOverride ? player.suspOffset : 0;
  ctx.translate(x, groundFootY - 7 + roadBounce + bodySusp);
  ctx.rotate(pitch);

  // Farol de LED mais forte à medida que escurece
  const beamLen = 145 + tod * 65;
  const beamAlpha = 0.44 + tod * 0.36;
  const beamGrad = ctx.createLinearGradient(58, -10, beamLen, -2);
  beamGrad.addColorStop(0, `rgba(254, 240, 138, ${beamAlpha})`);
  beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(58, -15);
  ctx.lineTo(beamLen, -32);
  ctx.lineTo(beamLen, 10);
  ctx.lineTo(58, -6);
  ctx.closePath();
  ctx.fill();

  // Carroceria blindada
  const activeSkin = getRenderSkin();
  const carGrad = ctx.createLinearGradient(0, -40, 0, 6);
  if (activeSkin === 'gold') {
    carGrad.addColorStop(0, '#fef9c3');
    carGrad.addColorStop(0.45, '#eab308');
    carGrad.addColorStop(1, '#713f12');
  } else if (activeSkin === 'stealth') {
    carGrad.addColorStop(0, '#312e81');
    carGrad.addColorStop(0.5, '#090d16');
    carGrad.addColorStop(1, '#020617');
  } else {
    carGrad.addColorStop(0, '#475569');
    carGrad.addColorStop(0.42, '#0f172a');
    carGrad.addColorStop(1, '#020617');
  }

  ctx.fillStyle = carGrad;
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-62, 2);
  ctx.lineTo(-60, -17);
  ctx.lineTo(-38, -20);
  ctx.lineTo(-18, -38);
  ctx.lineTo(24, -38);
  ctx.lineTo(42, -19);
  ctx.lineTo(62, -15);
  ctx.quadraticCurveTo(66, -5, 62, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fundo escuro da cabine + motorista dentro + vidro por cima
  ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
  ctx.beginPath();
  ctx.moveTo(-33, -19);
  ctx.lineTo(-16, -34);
  ctx.lineTo(22, -34);
  ctx.lineTo(37, -19);
  ctx.closePath();
  ctx.fill();

  if (withDriver) {
    const pal = getCharacterPalette(activeSkin);
    ctx.save();
    ctx.translate(10, -18);
    // Ombros do motorista + volante + braço
    ctx.fillStyle = pal.suitMain;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 8, 3);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(9, -1);
    ctx.lineTo(14, -10);
    ctx.stroke();
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.arc(13, -9, 2.4, 0, Math.PI * 2);
    ctx.fill();

    drawCaricatureHead(0.55, state.isHoldingAction);
    ctx.restore();
  }

  // Vidro translúcido com reflexo especular por cima do motorista
  ctx.fillStyle = 'rgba(186, 230, 253, 0.34)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-33, -19);
  ctx.lineTo(-16, -34);
  ctx.lineTo(22, -34);
  ctx.lineTo(37, -19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Coluna central e friso lateral por skin
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-2, -34, 4, 16);
  ctx.fillStyle = activeSkin === 'stealth' ? '#a855f7' : activeSkin === 'gold' ? '#fef08a' : '#e2e8f0';
  ctx.fillRect(-52, -12, 106, 2.5);

  // Giroflex no para-brisa
  const flashBlue = Math.floor(performance.now() * 0.015) % 2 === 0;
  ctx.fillStyle = flashBlue ? '#38bdf8' : '#ef4444';
  ctx.beginPath();
  ctx.arc(28, -22, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Farol dianteiro LED e lanterna traseira
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.roundRect(55, -14, 8, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(-62, -15, 6, 7, 2);
  ctx.fill();

  // Evolução visual do Carro por nível de Frota (vehicleTier)
  const carTier = activeRivalOverride ? 0 : (upgrades.vehicleTier || 0);
  if (carTier >= 1) {
    // Aerofólio traseiro esportivo
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-54, -22);
    ctx.lineTo(-65, -34);
    ctx.lineTo(-47, -32);
    ctx.lineTo(-46, -22);
    ctx.closePath();
    ctx.fill();
  }
  if (carTier >= 2) {
    // Barra tática LED no teto + quebra-mato dianteiro
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-14, -42, 24, 4);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(60, -16);
    ctx.lineTo(65, -14);
    ctx.lineTo(65, -2);
    ctx.stroke();
  }
  if (carTier >= 3) {
    // Bandeirinhas presidenciais no capô
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(42, -20);
    ctx.lineTo(42, -32);
    ctx.stroke();
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(42, -32, 9, 6);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(44, -30, 5, 2.5);
  }

  // Rodas esportivas blindadas (compensando suspensão para colarem no chão)
  for (const wx of [-36, 36]) {
    ctx.save();
    ctx.translate(wx, 2 - bodySusp * 0.65);
    ctx.rotate(wheelAngle);
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = activeSkin === 'gold' ? '#fde047' : '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    for (let r = 0; r < 3; r++) {
      const a = (r * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -7, Math.sin(a) * -7);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

export function drawExecutiveJet(x, y, pitch, propAngle, waveAngle, withPilot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pitch);

  const activeSkin = getRenderSkin();
  const rivalTurbo = activeRivalOverride ? Boolean(activeRivalOverride.turbo) : false;
  const localTurbo = !activeRivalOverride && (player.turboTimer > 0 || state.isHoldingAction);

  // Chamas de propulsão / Turbo Asa
  if (withPilot && (rivalTurbo || localTurbo)) {
    const isTurbo = activeRivalOverride ? rivalTurbo : player.turboTimer > 0;
    const flameLen = isTurbo ? 68 : 28 + Math.sin(propAngle * 2) * 6;
    const grad = ctx.createLinearGradient(-42, 4, -42 - flameLen, 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, isTurbo ? '#facc15' : '#38bdf8');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-40, -5);
    ctx.lineTo(-42 - flameLen, 4);
    ctx.lineTo(-40, 13);
    ctx.closePath();
    ctx.fill();
  }

  // Leme vertical traseiro com bandeira
  ctx.fillStyle = activeSkin === 'stealth' ? '#312e81' : activeSkin === 'gold' ? '#ca8a04' : '#1d4ed8';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.lineTo(-52, -26);
  ctx.lineTo(-28, -24);
  ctx.lineTo(-16, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-44, -19, 14, 5);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-42, -14, 12, 3);

  // Interior da cabine -> Piloto -> Vidro por cima!
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.beginPath();
  ctx.moveTo(-20, -13);
  ctx.quadraticCurveTo(-2, -39, 24, -13);
  ctx.closePath();
  ctx.fill();

  if (withPilot) {
    const pal = getCharacterPalette(activeSkin);
    ctx.save();
    ctx.translate(2, -12);
    ctx.fillStyle = pal.suitMain;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-9, -10, 18, 11, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(4, -10);
    ctx.lineTo(2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.tieMain;
    ctx.fillRect(0.5, -9, 2.5, 5);

    ctx.save();
    ctx.translate(-7, -7);
    ctx.rotate(-0.5 + Math.sin(waveAngle) * 0.45);
    ctx.strokeStyle = pal.suitMain;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -11);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, -11, 4, 2);
    ctx.fillStyle = '#fdba74';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-7, -12.5, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.translate(1, -6);
    drawCaricatureHead(0.54, state.isHoldingAction || player.turboTimer > 0);
    ctx.restore();
  }

  // Vidro translúcido e reflexo curvo POR CIMA do piloto
  ctx.fillStyle = 'rgba(186, 230, 253, 0.34)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-20, -13);
  ctx.quadraticCurveTo(-2, -39, 24, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -24);
  ctx.quadraticCurveTo(0, -32, 12, -23);
  ctx.stroke();

  // Fuselagem aerodinâmica por Skin
  const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
  if (activeSkin === 'gold') {
    bodyGrad.addColorStop(0, '#fef9c3');
    bodyGrad.addColorStop(0.55, '#facc15');
    bodyGrad.addColorStop(1, '#a16207');
  } else if (activeSkin === 'stealth') {
    bodyGrad.addColorStop(0, '#475569');
    bodyGrad.addColorStop(0.5, '#1e293b');
    bodyGrad.addColorStop(1, '#020617');
  } else {
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.65, '#f1f5f9');
    bodyGrad.addColorStop(1, '#cbd5e1');
  }

  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-42, 4);
  ctx.quadraticCurveTo(-36, -15, -6, -16);
  ctx.lineTo(26, -14);
  ctx.quadraticCurveTo(46, -10, 48, 3);
  ctx.quadraticCurveTo(46, 16, 18, 17);
  ctx.lineTo(-26, 15);
  ctx.quadraticCurveTo(-42, 13, -42, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = activeSkin === 'stealth' ? '#7c3aed' : '#2563eb';
  ctx.fillRect(-32, 0, 72, 5);
  ctx.fillStyle = activeSkin === 'stealth' ? '#38bdf8' : '#16a34a';
  ctx.fillRect(-28, 5, 64, 2.5);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-26, 7.5, 60, 2);

  // Asa principal com luz de navegação
  ctx.fillStyle = activeSkin === 'stealth' ? '#312e81' : activeSkin === 'gold' ? '#b45309' : '#1d4ed8';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.lineTo(-24, 25);
  ctx.lineTo(6, 25);
  ctx.lineTo(18, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = Math.floor(performance.now() * 0.008) % 2 === 0 ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-18, 24, 3, 0, Math.PI * 2);
  ctx.fill();

  // Evolução visual do Avião por nível de Frota (vehicleTier)
  const jetTier = activeRivalOverride ? 0 : (upgrades.vehicleTier || 0);
  if (jetTier >= 1) {
    // Winglet esportivo na ponta da asa
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-24, 25);
    ctx.lineTo(-27, 32);
    ctx.lineTo(-15, 25);
    ctx.closePath();
    ctx.fill();
  }
  if (jetTier >= 2) {
    // Canards furtivos dianteiros
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(22, -2);
    ctx.lineTo(14, -14);
    ctx.lineTo(28, -4);
    ctx.closePath();
    ctx.fill();
  }
  if (jetTier >= 3) {
    // Turbina extra presidencial no dorso
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-22, -19, 26, 7, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Nariz vermelho e hélice
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(47, -4);
  ctx.lineTo(57, 3);
  ctx.lineTo(47, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
  ctx.beginPath();
  ctx.ellipse(53, 3, 4, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  const propSpan = Math.abs(Math.sin(propAngle)) * 27 + 5;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(53, 3 - propSpan);
  ctx.lineTo(53, 3 + propSpan);
  ctx.stroke();

  ctx.restore();
}

export function renderSkinPreviews() {
  const previews = [
    { id: 'previewExecutivo', skin: 'executivo', bg: '#0ea5e9' },
    { id: 'previewStealth', skin: 'stealth', bg: '#6d28d9' },
    { id: 'previewGold', skin: 'gold', bg: '#d97706' }
  ];
  for (const p of previews) {
    const el = document.getElementById(p.id);
    if (!el) continue;
    const pctx = el.getContext('2d');
    pctx.clearRect(0, 0, el.width, el.height);

    pctx.fillStyle = p.bg;
    pctx.globalAlpha = 0.22;
    pctx.beginPath();
    pctx.arc(32, 26, 22, 0, Math.PI * 2);
    pctx.fill();
    pctx.globalAlpha = 1;

    // Busto detalhado do terno + lapela + lenço + cabeça caricaturada
    const pal = getCharacterPalette(p.skin);
    pctx.save();
    pctx.translate(30, 44);
    pctx.fillStyle = pal.suitMain;
    pctx.strokeStyle = '#0f172a';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.roundRect(-14, -2, 28, 13, 5);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#ffffff';
    pctx.beginPath();
    pctx.moveTo(-4, -2);
    pctx.lineTo(5, -2);
    pctx.lineTo(1, 7);
    pctx.closePath();
    pctx.fill();

    pctx.fillStyle = pal.tieMain;
    pctx.fillRect(-1, 0, 3.5, 8);

    pctx.fillStyle = pal.pocketSquare;
    pctx.fillRect(-10, 3, 5, 2.5);

    drawCaricatureHeadOn(pctx, 0.96, false, p.skin);
    pctx.restore();
  }
}

export function drawImpactComedyEffects() {
  const showStars = state.gameState === 'IMPACT' || (state.gameState === 'GAMEOVER' && state.lastImpactMeta && !state.lastImpactMeta.isTimeout);
  if (!showStars) return;

  // Âncora acima do rosto/cabine em qualquer ato
  const headAnchorY = state.currentAct === 1
    ? (player.slideTimer > 0 ? player.y - 54 : player.y - 98)
    : state.currentAct === 2
      ? player.y - 62
      : player.y - 46;

  // Três estrelinhas amarelas orbitando em órbita 3D inclinada
  ctx.save();
  ctx.translate(player.x + 4, headAnchorY);
  const orbitRx = 28;
  const orbitRy = 8;
  for (let i = 0; i < 3; i++) {
    const ang = state.dizzyStarAngle + (i * Math.PI * 2) / 3;
    const sx = Math.cos(ang) * orbitRx;
    const sy = Math.sin(ang) * orbitRy;
    const starScale = 0.8 + (Math.sin(ang) + 1) * 0.22;
    drawStar(ctx, sx, sy, 5, 7.5 * starScale, 3.6 * starScale, '#fde047', '#78350f');
  }
  ctx.restore();

  // Balão explosivo HQ ("BATEU!" / "CRASH!") durante o congelamento de impacto
  if (state.gameState === 'IMPACT') {
    const word = (state.lastImpactMeta && state.lastImpactMeta.comicWord) || 'BATEU!';
    const pop = Math.min(1, 0.72 + (0.42 - state.impactTimer) * 1.8);
    const bx = Math.min(state.logicalWidth - 110, player.x + 68);
    const by = Math.max(92, headAnchorY - 26);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.08);
    ctx.scale(pop, pop);

    // Estrela pontiaguda estilo quadrinhos
    const spikes = 14;
    const burstGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 62);
    burstGrad.addColorStop(0, '#fef08a');
    burstGrad.addColorStop(0.65, '#facc15');
    burstGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = burstGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let s = 0; s < spikes * 2; s++) {
      const a = (s * Math.PI) / spikes;
      const rx = s % 2 === 0 ? 70 : 48;
      const ry = s % 2 === 0 ? 40 : 26;
      const px = Math.cos(a) * rx;
      const py = Math.sin(a) * ry;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 26px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(word, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(word, 0, 1);
    ctx.restore();
  }
}

// =============================================================================
// CENÁRIOS DOS 3 ATOS, OBSTÁCULOS, COLETÁVEIS E PARTÍCULAS
// =============================================================================

import { LOGICAL_HEIGHT, ceilingY } from '../config.js';
import { ctx } from '../dom.js';
import { getTimeOfDayState, lerpColor, drawGroundShadow, drawStar } from './utils.js';
import { state, player } from '../state.js';

export function spawnExplosion(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
    const speed = 80 + Math.random() * 220;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3.5 + Math.random() * 4.5,
      life: 0.38 + Math.random() * 0.26,
      maxLife: 0.64,
      color,
      shape: i % 3 === 0 ? 'spark' : 'circle'
    });
  }
}

export function spawnDust(x, y, count = 6, color = 'rgba(226, 232, 240, 0.72)') {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 2 - Math.random() * 5,
      vx: -70 - Math.random() * 110,
      vy: -18 - Math.random() * 48,
      size: 4 + Math.random() * 5,
      life: 0.26 + Math.random() * 0.16,
      maxLife: 0.42,
      color,
      shape: 'dust'
    });
  }
}

export function addFloatingText(x, y, text, color) {
  state.floatingTexts.push({
    x,
    y,
    vy: -62,
    text,
    color,
    life: 0.9,
    maxLife: 0.9
  });
}

export function drawBackground() {
  const tod = getTimeOfDayState();
  const isDusk = tod > 0.35;
  const duskMix = tod <= 0.55 ? tod / 0.55 : (1 - (tod - 0.55) / 0.45);
  const nightMix = Math.max(0, (tod - 0.48) / 0.52);

  // Interpola Céu: Dia -> Entardecer -> Noite
  const topDay = state.currentAct === 2 ? [15, 23, 42] : [3, 105, 161];
  const topDusk = [88, 28, 135];
  const topNight = [2, 6, 23];

  const midDay = state.currentAct === 3 ? [14, 165, 233] : [56, 189, 248];
  const midDusk = [234, 88, 12];
  const midNight = [30, 27, 75];

  const botDay = [224, 242, 254];
  const botDusk = [253, 224, 71];
  const botNight = [49, 46, 129];

  const topCol = tod < 0.55 ? lerpColor(topDay, topDusk, tod / 0.55) : lerpColor(topDusk, topNight, (tod - 0.55) / 0.45);
  const midCol = tod < 0.55 ? lerpColor(midDay, midDusk, tod / 0.55) : lerpColor(midDusk, midNight, (tod - 0.55) / 0.45);
  const botCol = tod < 0.55 ? lerpColor(botDay, botDusk, tod / 0.55) : lerpColor(botDusk, botNight, (tod - 0.55) / 0.45);

  const skyGrad = ctx.createLinearGradient(0, -state.worldOffsetY, 0, LOGICAL_HEIGHT);
  skyGrad.addColorStop(0, topCol);
  skyGrad.addColorStop(0.55, midCol);
  skyGrad.addColorStop(1, botCol);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, -state.worldOffsetY, state.logicalWidth, state.logicalHeight);

  // Estrelas noturnas surgindo ao anoitecer
  if (nightMix > 0.1) {
    const nowSec = performance.now() * 0.003;
    for (const st of state.nightStars) {
      const twinkle = 0.45 + 0.55 * Math.sin(nowSec + st.phase);
      ctx.fillStyle = `rgba(255, 255, 255, ${nightMix * twinkle * 0.85})`;
      ctx.beginPath();
      ctx.arc(st.x % state.logicalWidth, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sol descendo no horizonte / Lua aparecendo à noite
  const sunX = state.logicalWidth * 0.83;
  const sunY = 110 + tod * 220;
  const sunAlpha = Math.max(0, 1 - nightMix * 1.15);
  if (sunAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = sunAlpha;
    const sunHalo = ctx.createRadialGradient(sunX, sunY, 18, sunX, sunY, 125);
    sunHalo.addColorStop(0, isDusk ? 'rgba(254, 215, 170, 0.9)' : 'rgba(254, 249, 195, 0.85)');
    sunHalo.addColorStop(0.45, isDusk ? 'rgba(249, 115, 22, 0.4)' : 'rgba(253, 224, 71, 0.35)');
    sunHalo.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunHalo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 125, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDusk ? '#fdba74' : '#fef08a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (nightMix > 0.15) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, nightMix);
    const moonX = state.logicalWidth * 0.78;
    const moonY = 98;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Nuvens volumétricas adaptadas à luz do dia/noite
  for (const c of state.clouds) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);

    const cloudShade = nightMix > 0.4
      ? `rgba(71, 85, 105, ${c.alpha * 0.7})`
      : duskMix > 0.45
        ? `rgba(253, 186, 116, ${c.alpha * 0.75})`
        : `rgba(186, 230, 253, ${c.alpha * 0.85})`;
    const cloudTop = nightMix > 0.4
      ? `rgba(148, 163, 184, ${c.alpha * 0.65})`
      : `rgba(255, 255, 255, ${c.alpha})`;

    ctx.fillStyle = cloudShade;
    ctx.beginPath();
    ctx.arc(4, 8, 28, 0, Math.PI * 2);
    ctx.arc(30, 2, 34, 0, Math.PI * 2);
    ctx.arc(62, 8, 26, 0, Math.PI * 2);
    ctx.roundRect(2, 10, 62, 24, 12);
    ctx.fill();

    ctx.fillStyle = cloudTop;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.arc(28, -12, 37, 0, Math.PI * 2);
    ctx.arc(60, -2, 28, 0, Math.PI * 2);
    ctx.roundRect(-2, -2, 64, 26, 12);
    ctx.fill();
    ctx.restore();
  }

  if (state.currentAct === 1) {
    drawAct1PlanaltoBackdrop(nightMix);
  } else if (state.currentAct === 2) {
    drawAct2HighwayBackdrop(nightMix);
  } else {
    drawAct3SkyBackdrop(nightMix);
  }
}

export function drawAct1PlanaltoBackdrop(nightMix = 0) {
  // Silhueta distante do Congresso Nacional + Torre de TV de Brasília
  ctx.fillStyle = nightMix > 0.4 ? 'rgba(2, 6, 23, 0.45)' : 'rgba(15, 23, 42, 0.18)';
  for (let sx = -state.bgFarOffset; sx < state.logicalWidth + 1600; sx += 1600) {
    // Torre de TV distante com luz de aviso piscando
    const tvX = sx + 340;
    ctx.beginPath();
    ctx.moveTo(tvX - 18, state.groundY);
    ctx.lineTo(tvX - 4, state.groundY - 175);
    ctx.lineTo(tvX + 4, state.groundY - 175);
    ctx.lineTo(tvX + 18, state.groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(tvX - 16, state.groundY - 115, 32, 10);
    ctx.fillRect(tvX - 1.5, state.groundY - 210, 3, 35);
    if (Math.floor(performance.now() * 0.004) % 2 === 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(tvX, state.groundY - 212, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = nightMix > 0.4 ? 'rgba(2, 6, 23, 0.45)' : 'rgba(15, 23, 42, 0.18)';
    }

    // Congresso Nacional
    const cx = sx + 960;
    ctx.fillRect(cx - 130, state.groundY - 28, 260, 28);
    ctx.fillRect(cx - 24, state.groundY - 140, 20, 112);
    ctx.fillRect(cx + 4, state.groundY - 140, 20, 112);
    ctx.beginPath();
    ctx.arc(cx - 68, state.groundY - 28, 30, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 72, state.groundY - 48, 34, 0, Math.PI);
    ctx.fill();
  }

  // Palácio do Planalto estilizado, espelho d'água, multidão distante e Ipês
  for (let px = -state.bgMidOffset; px < state.logicalWidth + 1200; px += 1200) {
    const base = state.groundY - 10;
    const glassGrad = ctx.createLinearGradient(px + 120, base - 130, px + 600, base - 15);
    if (nightMix > 0.35) {
      glassGrad.addColorStop(0, 'rgba(250, 204, 21, 0.38)');
      glassGrad.addColorStop(0.5, 'rgba(30, 58, 138, 0.7)');
      glassGrad.addColorStop(1, 'rgba(253, 224, 71, 0.28)');
    } else {
      glassGrad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
      glassGrad.addColorStop(0.5, 'rgba(30, 64, 175, 0.46)');
      glassGrad.addColorStop(1, 'rgba(56, 189, 248, 0.42)');
    }
    ctx.fillStyle = glassGrad;
    ctx.fillRect(px + 120, base - 130, 480, 115);

    // Brilho diagonal no vidro do Planalto
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(px + 160, base - 128);
    ctx.lineTo(px + 250, base - 128);
    ctx.lineTo(px + 190, base - 18);
    ctx.lineTo(px + 125, base - 18);
    ctx.closePath();
    ctx.fill();

    // Mastro com bandeira nacional tremulando no topo do Palácio
    const flagPoleX = px + 360;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(flagPoleX, base - 144);
    ctx.lineTo(flagPoleX, base - 190);
    ctx.stroke();
    const fw = Math.sin(performance.now() * 0.008) * 3;
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(flagPoleX, base - 188);
    ctx.quadraticCurveTo(flagPoleX + 18, base - 191 + fw, flagPoleX + 34, base - 186 - fw);
    ctx.lineTo(flagPoleX + 34, base - 168 - fw);
    ctx.quadraticCurveTo(flagPoleX + 18, base - 171 + fw, flagPoleX, base - 168);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(flagPoleX + 17, base - 185);
    ctx.lineTo(flagPoleX + 29, base - 177);
    ctx.lineTo(flagPoleX + 17, base - 170);
    ctx.lineTo(flagPoleX + 5, base - 177);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(flagPoleX + 17, base - 177.5, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Laje superior e inferior em mármore
    ctx.fillStyle = nightMix > 0.5 ? '#cbd5e1' : '#f8fafc';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.fillRect(px + 95, base - 144, 530, 15);
    ctx.strokeRect(px + 95, base - 144, 530, 15);
    ctx.fillRect(px + 105, base - 18, 510, 18);

    // Espelho d'água azul em frente ao Planalto
    ctx.fillStyle = nightMix > 0.4 ? 'rgba(14, 116, 144, 0.55)' : 'rgba(56, 189, 248, 0.45)';
    ctx.fillRect(px + 105, base, 510, 10);

    // Colunas modernistas curvas de Niemeyer
    for (let col = 0; col < 8; col++) {
      const cx = px + 130 + col * 64;
      ctx.fillStyle = nightMix > 0.5 ? '#e2e8f0' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - 4, base - 129);
      ctx.quadraticCurveTo(cx + 9, base - 72, cx - 4, base - 18);
      ctx.lineTo(cx + 14, base - 18);
      ctx.quadraticCurveTo(cx + 3, base - 72, cx + 14, base - 129);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Rampa inclinada do Planalto
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(px + 610, base - 48);
    ctx.lineTo(px + 795, base + 10);
    ctx.lineTo(px + 750, base + 10);
    ctx.lineTo(px + 610, base - 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jardins e arbustos baixos da Praça dos Três Poderes
    ctx.fillStyle = nightMix > 0.45 ? '#14532d' : '#15803d';
    for (let b = 0; b < 5; b++) {
      const bx = px + 820 + b * 46;
      ctx.beginPath();
      ctx.arc(bx, base, 14, Math.PI, 0);
      ctx.arc(bx + 14, base, 11, Math.PI, 0);
      ctx.fill();
    }
    // Gradil metálico baixo
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 800, base - 4);
    ctx.lineTo(px + 1030, base - 4);
    ctx.stroke();

    // Ipê Amarelo de Brasília entre os blocos
    const treeX = px + 1075;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(treeX - 5, base - 56, 10, 66);
    ctx.fillStyle = nightMix > 0.5 ? '#ca8a04' : '#facc15';
    ctx.beginPath();
    ctx.arc(treeX - 18, base - 64, 22, 0, Math.PI * 2);
    ctx.arc(treeX + 18, base - 64, 22, 0, Math.PI * 2);
    ctx.arc(treeX, base - 82, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calçadão de mármore / pedra portuguesa onde corre + gramado inferior
  const walkGrad = ctx.createLinearGradient(0, state.groundY, 0, state.groundY + 34);
  walkGrad.addColorStop(0, nightMix > 0.45 ? '#64748b' : '#e2e8f0');
  walkGrad.addColorStop(1, nightMix > 0.45 ? '#475569' : '#cbd5e1');
  ctx.fillStyle = walkGrad;
  ctx.fillRect(0, state.groundY, state.logicalWidth, 34);

  // Meio-fio 3D e juntas das lajes do calçadão
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, state.groundY - 2, state.logicalWidth, 2.5);
  ctx.fillStyle = nightMix > 0.45 ? '#334155' : '#94a3b8';
  ctx.fillRect(0, state.groundY + 30, state.logicalWidth, 6);
  for (let gx = -state.groundOffset; gx < state.logicalWidth + 90; gx += 90) {
    ctx.strokeStyle = nightMix > 0.45 ? 'rgba(15, 23, 42, 0.32)' : 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(gx, state.groundY);
    ctx.lineTo(gx - 12, state.groundY + 30);
    ctx.stroke();
  }

  const worldBottom = state.logicalHeight - state.worldOffsetY;
  const grassGrad = ctx.createLinearGradient(0, state.groundY + 36, 0, worldBottom);
  grassGrad.addColorStop(0, nightMix > 0.5 ? '#15803d' : '#16a34a');
  grassGrad.addColorStop(1, '#052e16');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, state.groundY + 36, state.logicalWidth, worldBottom - (state.groundY + 36));
}

export function drawAct2HighwayBackdrop(nightMix = 0) {
  const approachingAirport = state.distanceMeters >= 820;
  const horizonY = state.groundY - 26;
  const roadTopY = state.groundY - 12;

  // Silhueta da Esplanada (Catedral + Ministérios iluminados) ou Hangares + Torre do Aeroporto ancorados atrás da calçada
  for (let sx = -state.bgFarOffset; sx < state.logicalWidth + 1600; sx += 1600) {
    if (!approachingAirport) {
      // Catedral de Brasília estilizada
      const catX = sx + 680;
      ctx.strokeStyle = nightMix > 0.4 ? 'rgba(226, 232, 240, 0.35)' : 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 3.5;
      for (let arc = -3; arc <= 3; arc++) {
        ctx.beginPath();
        ctx.moveTo(catX + arc * 14, horizonY);
        ctx.quadraticCurveTo(catX + arc * 3, horizonY - 62, catX + arc * 10, horizonY - 98);
        ctx.stroke();
      }

      // Bloco de Ministérios com janelas iluminadas
      const blocks = [60, 230, 400, 860, 1050, 1280];
      for (const bx of blocks) {
        ctx.fillStyle = nightMix > 0.4 ? 'rgba(15, 23, 42, 0.65)' : 'rgba(30, 41, 59, 0.34)';
        ctx.fillRect(sx + bx, horizonY - 74, 132, 74);
        ctx.fillStyle = nightMix > 0.35 ? 'rgba(253, 224, 71, 0.48)' : 'rgba(186, 230, 253, 0.42)';
        for (let wy = horizonY - 64; wy < horizonY - 12; wy += 16) {
          for (let wx = 12; wx <= 104; wx += 22) {
            ctx.fillRect(sx + bx + wx, wy, 14, 7);
          }
        }
      }
    } else {
      // Hangares + Torre de Controle + Biruta
      ctx.fillStyle = nightMix > 0.4 ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.arc(sx + 260, horizonY, 130, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 920, horizonY, 150, Math.PI, 0);
      ctx.fill();

      const tx = sx + 580;
      ctx.fillRect(tx - 16, horizonY - 165, 32, 165);
      ctx.fillRect(tx - 34, horizonY - 195, 68, 30);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.fillRect(tx - 28, horizonY - 188, 56, 14);
      ctx.fillStyle = nightMix > 0.4 ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.28)';
      ctx.save();
      ctx.translate(tx, horizonY - 206);
      ctx.scale(Math.cos(state.radarAngle), 1);
      ctx.fillRect(-24, -6, 48, 8);
      ctx.restore();

      // Luzes azuis na borda do pátio do aeroporto
      ctx.fillStyle = '#22d3ee';
      for (let lx = 80; lx < 1520; lx += 180) {
        ctx.beginPath();
        ctx.arc(sx + lx, horizonY - 4, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Calçada elevada e meio-fio 3D bem separados acima da pista de asfalto
  ctx.fillStyle = nightMix > 0.45 ? '#334155' : '#cbd5e1';
  ctx.fillRect(0, horizonY, state.logicalWidth, 10);
  for (let gx = -state.groundOffset; gx < state.logicalWidth + 90; gx += 72) {
    ctx.strokeStyle = nightMix > 0.45 ? 'rgba(15, 23, 42, 0.45)' : 'rgba(100, 116, 139, 0.36)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, horizonY);
    ctx.lineTo(gx - 8, horizonY + 10);
    ctx.stroke();
  }
  // Face vertical do meio-fio
  ctx.fillStyle = nightMix > 0.45 ? '#475569' : '#94a3b8';
  ctx.fillRect(0, horizonY + 10, state.logicalWidth, 4);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, roadTopY - 1.5, state.logicalWidth, 1.5);

  // Postes de iluminação rodoviária e Placas ("AEROPORTO ->") apoiados na calçada
  for (let mx = -state.bgMidOffset; mx < state.logicalWidth + 1200; mx += 600) {
    const lampX = mx + 120;
    ctx.fillStyle = '#334155';
    ctx.fillRect(lampX - 3, horizonY - 128, 6, 134);
    ctx.fillRect(lampX - 3, horizonY - 128, 26, 5);
    if (nightMix > 0.2) {
      const glow = ctx.createRadialGradient(lampX + 18, horizonY - 122, 4, lampX + 18, horizonY - 78, 95);
      glow.addColorStop(0, `rgba(254, 240, 138, ${nightMix * 0.55})`);
      glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lampX + 18, horizonY - 92, 95, 0, Math.PI * 2);
      ctx.fill();
    }

    const signX = mx + 360;
    ctx.fillStyle = '#475569';
    ctx.fillRect(signX - 4, horizonY - 104, 8, 110);

    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(signX - 78, horizonY - 138, 156, 38, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(approachingAirport ? 'EMBARQUE JATO  ->' : 'AEROPORTO  ->', signX, horizonY - 119);
  }

  // Guard-rail metálico contínuo montado sobre a calçada (atrás dos veículos)
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, horizonY - 14, state.logicalWidth, 5.5);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, horizonY - 14, state.logicalWidth, 2);
  for (let gx = -state.groundOffset; gx < state.logicalWidth + 90; gx += 45) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(gx, horizonY - 11, 4, 15);
  }

  // Pista de Asfalto do Eixo Monumental (abaixo do meio-fio, onde os veículos realmente trafegam)
  const worldBottom = state.logicalHeight - state.worldOffsetY;
  const roadGrad = ctx.createLinearGradient(0, roadTopY, 0, worldBottom);
  roadGrad.addColorStop(0, '#1e293b');
  roadGrad.addColorStop(0.55, '#0f172a');
  roadGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, roadTopY, state.logicalWidth, worldBottom - roadTopY);

  // Faixa amarela contínua de acostamento na borda superior da pista
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, roadTopY + 3, state.logicalWidth, 3.5);

  // Marcas sutis de rodagem de pneus na faixa dos veículos
  ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.fillRect(0, state.groundY - 1, state.logicalWidth, 5);
  ctx.fillRect(0, state.groundY + 10, state.logicalWidth, 5);

  // Faixa tracejada branca divisória de pista
  ctx.fillStyle = '#f8fafc';
  for (let gx = -state.groundOffset; gx < state.logicalWidth + 90; gx += 90) {
    ctx.fillRect(gx, state.groundY + 36, 48, 6);
  }

  // Borda inferior do asfalto
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.fillRect(0, worldBottom - 8, state.logicalWidth, 2);
}

export function drawAct3SkyBackdrop(nightMix = 0) {
  // Horizonte distante de Brasília com Ponte JK + luzes urbanas + Lago Paranoá
  ctx.fillStyle = nightMix > 0.35 ? 'rgba(2, 6, 23, 0.42)' : 'rgba(15, 23, 42, 0.22)';
  for (let sx = -state.bgFarOffset; sx < state.logicalWidth + 1600; sx += 1600) {
    const blocks = [60, 240, 820, 1000, 1360];
    for (const bx of blocks) {
      ctx.fillRect(sx + bx, state.groundY - 64, 120, 64);
      if (nightMix > 0.3) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.48)';
        for (let wy = state.groundY - 54; wy < state.groundY - 14; wy += 16) {
          ctx.fillRect(sx + bx + 14, wy, 12, 6);
          ctx.fillRect(sx + bx + 44, wy, 12, 6);
          ctx.fillRect(sx + bx + 78, wy, 12, 6);
        }
        ctx.fillStyle = nightMix > 0.35 ? 'rgba(2, 6, 23, 0.42)' : 'rgba(15, 23, 42, 0.22)';
      }
    }
    // Ponte JK estilizada (3 arcos icônicos)
    const pjx = sx + 1120;
    ctx.fillRect(pjx, state.groundY - 12, 220, 6);
    ctx.strokeStyle = nightMix > 0.35 ? 'rgba(226, 232, 240, 0.32)' : 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 3;
    for (let a = 0; a < 3; a++) {
      const ax = pjx + 35 + a * 72;
      ctx.beginPath();
      ctx.arc(ax, state.groundY - 10, 32, Math.PI, 0);
      ctx.stroke();
    }

    const cx = sx + 560;
    ctx.fillRect(cx - 140, state.groundY - 28, 280, 28);
    ctx.fillRect(cx - 26, state.groundY - 150, 22, 122);
    ctx.fillRect(cx + 4, state.groundY - 150, 22, 122);
    ctx.beginPath();
    ctx.arc(cx - 72, state.groundY - 28, 34, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 76, state.groundY - 52, 38, 0, Math.PI);
    ctx.fill();
  }

  // Colinas suaves do horizonte
  ctx.fillStyle = nightMix > 0.45 ? '#0f172a' : '#0284c7';
  for (let hx = -state.bgMidOffset; hx < state.logicalWidth + 1200; hx += 600) {
    ctx.beginPath();
    ctx.moveTo(hx, state.groundY);
    ctx.quadraticCurveTo(hx + 150, state.groundY - 46, hx + 300, state.groundY);
    ctx.quadraticCurveTo(hx + 450, state.groundY - 32, hx + 600, state.groundY);
    ctx.closePath();
    ctx.fill();
  }

  // Lago Paranoá estilizado lá embaixo com reflexos em movimento
  const worldBottom = state.logicalHeight - state.worldOffsetY;
  const lakeGrad = ctx.createLinearGradient(0, state.groundY, 0, worldBottom);
  lakeGrad.addColorStop(0, nightMix > 0.45 ? '#0c4a6e' : '#0369a1');
  lakeGrad.addColorStop(1, '#082f49');
  ctx.fillStyle = lakeGrad;
  ctx.fillRect(0, state.groundY, state.logicalWidth, worldBottom - state.groundY);

  if (state.worldOffsetY > 24) {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(state.logicalWidth, ceilingY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
  ctx.fillRect(0, state.groundY, state.logicalWidth, 5);
  for (let gx = -state.groundOffset; gx < state.logicalWidth + 90; gx += 90) {
    ctx.fillRect(gx + 10, state.groundY + 24, 34, 3);
    ctx.fillRect(gx + 48, state.groundY + 48, 24, 2.5);
  }

  // Aviso sutil de altitude baixa se o jato estiver muito perto da água
  if (state.gameState === 'PLAYING' && player.y > state.groundY - 82) {
    const warnAlpha = Math.min(0.45, ((player.y - (state.groundY - 82)) / 58) * 0.45);
    ctx.fillStyle = `rgba(239, 68, 68, ${warnAlpha})`;
    ctx.fillRect(0, state.groundY - 10, state.logicalWidth, 10);
  }
}

export function drawObstacles() {
  for (const obs of state.obstacles) {
    if (obs.type === 'camera_tripod') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Tripé cromado articulado com sapatas
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(-19, -2);
      ctx.moveTo(0, -34);
      ctx.lineTo(19, -2);
      ctx.moveTo(0, -34);
      ctx.lineTo(0, -1);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      for (const fx of [-19, 0, 19]) {
        ctx.beginPath();
        ctx.arc(fx, -1, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Corpo da câmera ENG + microfone com espuma
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-18, -59, 36, 25, 5);
      ctx.fill();
      ctx.stroke();

      // Lente com para-sol e reflexo azulado
      ctx.fillStyle = '#334155';
      ctx.fillRect(-31, -53, 13, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-28, -46, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Microfone no topo + badge "AO VIVO"
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(-8, -69, 18, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 5.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AO VIVO', 1, -63.5);

      if (Math.floor(obs.blink) % 2 === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(11, -53, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (obs.type === 'press_drone') {
      drawGroundShadow(obs.x, obs.width * 0.8);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Feixe de câmera abaixo do drone sinalizando espaço para agachar
      const beam = ctx.createLinearGradient(0, 10, 0, 62);
      beam.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      beam.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-12, 10);
      ctx.lineTo(-28, 60);
      ctx.lineTo(28, 60);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();

      // Dica visual sutil "↓" piscando no início do Ato 1
      if (state.distanceMeters < 180) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
        ctx.font = '900 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↓ AGACHE', 0, -24);
      }

      // Hastes e hélices giratórias animadas
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-29, -10);
      ctx.lineTo(29, -10);
      ctx.stroke();

      const bladeW = 7 + Math.abs(Math.sin(performance.now() * 0.04)) * 10;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.beginPath();
      ctx.ellipse(-27, -14, bladeW, 2.8, 0, 0, Math.PI * 2);
      ctx.ellipse(27, -14, bladeW, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Corpo do drone "TV"
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -10, 44, 19, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-10, 2, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(-11.5, 0.5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = Math.floor(obs.blink) % 2 === 0 ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(11, -1, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (obs.type === 'boom_mic') {
      drawGroundShadow(obs.x, obs.width * 0.75);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Feixe amarelo/âmbar abaixo indicando espaço de Slide
      const beam = ctx.createLinearGradient(0, 10, 0, 56);
      beam.addColorStop(0, 'rgba(250, 204, 21, 0.22)');
      beam.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(-28, 56);
      ctx.lineTo(28, 56);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();

      if (state.distanceMeters < 220) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
        ctx.font = '900 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↓ AGACHE', 0, -24);
      }

      // Haste diagonal do boom vinda de cima
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(28, -90);
      ctx.lineTo(-6, -4);
      ctx.stroke();

      // Espuma protetora do microfone + LED AO VIVO
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-24, -10, 32, 16, 8);
      ctx.fill();
      ctx.stroke();

      // Placa "AO VIVO"
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-22, 6, 44, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 8.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AO VIVO', 0, 13);

      if (Math.floor(obs.blink) % 2 === 0) {
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(13, -3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else if (obs.type === 'protest_banner') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);
      const sway = Math.sin((obs.phase || 0) + performance.now() * 0.006) * 1.8;

      // Estacas de madeira
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.fillRect(-38, -58, 5, 58);
      ctx.strokeRect(-38, -58, 5, 58);
      ctx.fillRect(33, -58, 5, 58);
      ctx.strokeRect(33, -58, 5, 58);

      // Faixa vermelha da esquerda com slogan legível e estrela
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-36, -54);
      ctx.quadraticCurveTo(0, -56 + sway, 36, -54);
      ctx.lineTo(36, -24);
      ctx.quadraticCurveTo(0, -26 + sway, -36, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Faixa branca interna para contraste do texto
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(-31, -46 + sway * 0.4, 62, 14);
      ctx.fillStyle = '#991b1b';
      ctx.font = '900 7.6px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obs.slogan || 'SEM ANISTIA!', 0, -39 + sway * 0.4);
      ctx.restore();
    } else if (obs.type === 'cavalete') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Estrutura metálica articulada da grade/cavalete
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(-12, -46);
      ctx.moveTo(24, 0);
      ctx.lineTo(12, -46);
      ctx.stroke();

      // Barra inferior de apoio
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.lineTo(18, -12);
      ctx.stroke();

      // Prancha amarela zebrada + placa de alerta
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.roundRect(-29, -45, 58, 19, 4);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-29, -45, 58, 19, 4);
      ctx.clip();
      ctx.fillStyle = '#0f172a';
      for (let sx = -32; sx <= 28; sx += 16) {
        ctx.beginPath();
        ctx.moveTo(sx, -45);
        ctx.lineTo(sx + 8, -45);
        ctx.lineTo(sx + 2, -26);
        ctx.lineTo(sx - 6, -26);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -49, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (obs.type === 'traffic_cones') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Fita zebrada ligando os cones
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, -28);
      ctx.lineTo(22, -28);
      ctx.stroke();

      for (const cx of [-22, 0, 22]) {
        // Base de borracha preta do cone
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(cx - 14, -5, 28, 5, 2);
        ctx.fill();

        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 11, -4);
        ctx.lineTo(cx - 4, -39);
        ctx.lineTo(cx + 4, -39);
        ctx.lineTo(cx + 11, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 7, -23, 14, 7);
      }
      ctx.restore();
    } else if (obs.type === 'blitz_block') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-34, -48, 68, 36, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      for (let sx = -27; sx <= 15; sx += 21) {
        ctx.fillRect(sx, -48, 10, 36);
      }

      // Placa "BLOQUEIO"
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-24, -37, 48, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.font = '900 7.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLOQUEIO', 0, -30);

      ctx.fillStyle = '#334155';
      ctx.fillRect(-27, -12, 6, 12);
      ctx.fillRect(21, -12, 6, 12);

      const redOn = Math.floor(obs.blink) % 2 === 0;
      ctx.fillStyle = redOn ? 'rgba(239, 68, 68, 0.28)' : 'rgba(59, 130, 246, 0.28)';
      ctx.beginPath();
      ctx.arc(0, -54, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = redOn ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, -54, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (obs.type === 'radar_van') {
      drawGroundShadow(obs.x, obs.width);
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Feixe de detecção piscante voltado para o jogador
      const redOn = Math.floor(obs.blink) % 2 === 0;
      const beam = ctx.createLinearGradient(-16, -26, -64, -26);
      beam.addColorStop(0, redOn ? 'rgba(239, 68, 68, 0.28)' : 'rgba(56, 189, 248, 0.22)');
      beam.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-18, -32);
      ctx.lineTo(-64, -46);
      ctx.lineTo(-64, -10);
      ctx.lineTo(-18, -22);
      ctx.closePath();
      ctx.fill();

      // Carroceria / totem do Radar Móvel
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-34, -42, 68, 34, 7);
      ctx.fill();
      ctx.stroke();

      // Listras azuis laterais
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-33, -21, 66, 8);

      // Lente do radar e placa RADAR 60
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-20, -31, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-20, -31, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-8, -38, 38, 15, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 7.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RADAR 60', 11, -30.5);

      // Rodas e giroflex
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-19, -5, 6.5, 0, Math.PI * 2);
      ctx.arc(19, -5, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = redOn ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, -47, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (obs.type === 'gavel_barrier' || obs.type === 'sky_gavel') {
      if (obs.type === 'gavel_barrier') drawGroundShadow(obs.x, 54);
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.angle);

      // Rastro sutil de giro
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -0.8, 0.8);
      ctx.stroke();

      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-6, -8, 12, 46, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-30, -28, 60, 24, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.fillRect(-9, -28, 18, 24);
      ctx.strokeRect(-9, -28, 18, 24);
      ctx.restore();
    } else if (obs.type === 'sky_barrier') {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      const halfW = obs.width * 0.5;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-halfW, 0, obs.width, obs.height, 8);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-halfW, 0, obs.width, obs.height, 8);
      ctx.clip();
      ctx.fillStyle = '#dc2626';
      for (let sy = -obs.width; sy < obs.height + obs.width; sy += 34) {
        ctx.beginPath();
        ctx.moveTo(-halfW, sy);
        ctx.lineTo(halfW, sy + 18);
        ctx.lineTo(halfW, sy + 35);
        ctx.lineTo(-halfW, sy + 17);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      const lightOn = Math.floor(obs.blink) % 2 === 0;
      for (const ly of [6, obs.height - 6]) {
        if (lightOn) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.beginPath();
          ctx.arc(0, ly, 13, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = lightOn ? '#ef4444' : '#7f1d1d';
        ctx.beginPath();
        ctx.arc(0, ly, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (obs.type === 'sky_dossier') {
      if (obs.warningTimer > 0) {
        ctx.save();
        ctx.translate(state.logicalWidth - 44, obs.y);
        const pulse = 1 + Math.sin(performance.now() * 0.022) * 0.15;
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 22px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.tilt);
        for (let p = 2; p >= 0; p--) {
          ctx.fillStyle = p === 0 ? '#fef3c7' : '#fde68a';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.roundRect(-41, -18 - p * 4, 82, 36, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-8, -26, 16, 44);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-34, -13, 68, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#b91c1c';
        ctx.font = '900 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MANDADO', 0, -4);
        ctx.restore();
      }
    } else if (obs.type === 'sky_helicopter') {
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Holofote diagonal
      const spot = ctx.createLinearGradient(-12, 14, -42, 92);
      spot.addColorStop(0, 'rgba(254, 240, 138, 0.34)');
      spot.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.moveTo(-14, 12);
      ctx.lineTo(-56, 92);
      ctx.lineTo(-10, 92);
      ctx.lineTo(-2, 12);
      ctx.closePath();
      ctx.fill();

      // Esquis de pouso
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-22, 19);
      ctx.lineTo(22, 19);
      ctx.moveTo(-12, 12);
      ctx.lineTo(-14, 19);
      ctx.moveTo(12, 12);
      ctx.lineTo(14, 19);
      ctx.stroke();

      // Cauda + rotor de cauda
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(14, -6, 32, 8, 3);
      ctx.fill();
      ctx.stroke();
      const tailSpin = Math.sin(performance.now() * 0.05) * 9;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(44, -2 - tailSpin);
      ctx.lineTo(44, -2 + tailSpin);
      ctx.stroke();

      // Cabine do Helicóptero "TV"
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 28, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Para-brisa azul brilhante
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(-18, -2, 11, 8, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Selo "TV"
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-2, -7, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TV', 8, 0);

      // Hélice principal animada
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, -20, 6, 6);
      const mainBladeW = 14 + Math.abs(Math.sin(performance.now() * 0.045)) * 30;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -21, mainBladeW, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Luz estroboscópica piscante
      ctx.fillStyle = Math.floor(obs.blink) % 2 === 0 ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(38, -9, 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}

export function drawCollectibles() {
  for (const item of state.collectibles) {
    ctx.save();
    ctx.translate(item.x, item.y);

    if (item.type === 'star') {
      if (item.magnetized) {
        ctx.beginPath();
        ctx.arc(0, 0, 21, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      drawStar(ctx, 0, 0, 5, 16, 7.2, '#facc15', '#854d0e');
    } else if (item.type === 'ring') {
      // Anel Aéreo de Velocidade e Bônus
      const pulse = 1 + Math.sin(item.phase * 1.5) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'coffee') {
      ctx.fillStyle = '#0891b2';
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-9, -4, 15, 13, [2, 2, 6, 6]);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(6, 2, 4, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.lineTo(-4, -12);
      ctx.moveTo(1, -8);
      ctx.lineTo(1, -12);
      ctx.stroke();
    } else if (item.type === 'shield') {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, -6);
      ctx.lineTo(9, 2);
      ctx.quadraticCurveTo(9, 9, 0, 13);
      ctx.quadraticCurveTo(-9, 9, -9, 2);
      ctx.lineTo(-9, -6);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'turbo') {
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(2, -12);
      ctx.lineTo(-8, 2);
      ctx.lineTo(-1, 2);
      ctx.lineTo(-3, 12);
      ctx.lineTo(8, -2);
      ctx.lineTo(1, -2);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'road_ramp') {
      // Rampa amarela-laranja apoiada no asfalto com setas »
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-26, 12);
      ctx.lineTo(24, 12);
      ctx.lineTo(24, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Faixa de destaque superior
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 10);
      ctx.lineTo(22, -12);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('»', 10, 4);
    } else if (item.type === 'wind_stream') {
      // Corrente de Jato Favorável em esmeralda/ciano
      const pulse = 1 + Math.sin(item.phase * 1.6) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Linhas de fluxo e chevron de velocidade
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -6);
      ctx.lineTo(6, -6);
      ctx.moveTo(-8, 0);
      ctx.lineTo(11, 0);
      ctx.moveTo(-12, 6);
      ctx.lineTo(6, 6);
      ctx.moveTo(3, -8);
      ctx.lineTo(12, 0);
      ctx.lineTo(3, 8);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function drawParticlesAndEffects() {
  // Linhas de velocidade nas bordas
  for (const sl of state.speedLines) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${sl.alpha})`;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y);
    ctx.lineTo(sl.x + sl.len, sl.y);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    if (p.shape === 'spark') {
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-p.size, -1.6, p.size * 2.2, 3.2);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const ft of state.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = '800 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // Vinheta pulsante sutil quando o prazo de 24h está crítico (< 4.5h)
  if (state.gameState === 'PLAYING' && state.currentAct < 3 && state.clockHours <= 4.5 && state.clockFreezeTimer <= 0) {
    const pulse = 0.16 + Math.abs(Math.sin(performance.now() * 0.006)) * 0.16;
    const vignetteCenterY = state.logicalHeight * 0.5 - state.worldOffsetY;
    const vignetteSpan = Math.max(state.logicalWidth, state.logicalHeight);
    const vGrad = ctx.createRadialGradient(
      state.logicalWidth * 0.5, vignetteCenterY, vignetteSpan * 0.25,
      state.logicalWidth * 0.5, vignetteCenterY, vignetteSpan * 0.65
    );
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, `rgba(220, 38, 38, ${pulse})`);
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, -state.worldOffsetY, state.logicalWidth, state.logicalHeight);
  }

  // Flash suave na troca de Ato
  if (state.transitionFlash > 0) {
    ctx.fillStyle = `rgba(224, 242, 254, ${state.transitionFlash * 0.45})`;
    ctx.fillRect(0, -state.worldOffsetY, state.logicalWidth, state.logicalHeight);
  }

  // Luzes de sirene vermelha e azul nas bordas quando o prazo de 24h zera
  if (state.sirenFlashTimer > 0) {
    const isRed = Math.floor(state.sirenFlashTimer * 10) % 2 === 0;
    const edgeCenterY = state.logicalHeight * 0.5 - state.worldOffsetY;
    const edgeSpan = Math.max(state.logicalWidth, state.logicalHeight);
    const edgeGrad = ctx.createRadialGradient(
      state.logicalWidth * 0.5,
      edgeCenterY,
      edgeSpan * 0.25,
      state.logicalWidth * 0.5,
      edgeCenterY,
      edgeSpan * 0.65
    );
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, isRed ? 'rgba(239, 68, 68, 0.45)' : 'rgba(59, 130, 246, 0.45)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, -state.worldOffsetY, state.logicalWidth, state.logicalHeight);
  }
}

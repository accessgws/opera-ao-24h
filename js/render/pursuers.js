// =============================================================================
// RENDERIZAÇÃO DOS PERSEGUIDORES (REPÓRTER, VIATURA E HELICÓPTERO PF)
// =============================================================================

import { ceilingY } from '../config.js';
import { ctx } from '../dom.js';
import { drawArticulatedLeg } from './player.js';
import { drawGroundShadow, drawStar, getTimeOfDayState } from './utils.js';
import { state, player } from '../state.js';

export function drawPursuerRunner(px, cycle, withFlag) {
  const stride = Math.sin(cycle);
  const bob = Math.abs(Math.cos(cycle)) * -5.5;
  const frontHip = stride * 0.78;
  const frontKnee = Math.max(0.12, -stride * 0.7 + 0.35);
  const backHip = -stride * 0.78;
  const backKnee = Math.max(0.12, stride * 0.7 + 0.35);

  // Sombra no chão sob os pés
  drawGroundShadow(px, 38);

  ctx.save();
  ctx.translate(px, state.groundY + bob);
  ctx.rotate(0.16);

  // Braço traseiro balançando
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(stride * 0.65);
  ctx.fillStyle = '#991b1b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.roundRect(-4, 0, 8, 17, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.arc(0, 18, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Perna traseira articulada (com joelho e sapato)
  ctx.save();
  ctx.translate(-2, -30);
  drawArticulatedLeg(backHip, backKnee, '#0f172a', true);
  ctx.restore();

  // Tronco camiseta vermelha + estrela branca
  ctx.fillStyle = withFlag ? '#b91c1c' : '#dc2626';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-11, -55, 22, 27, 6);
  ctx.fill();
  ctx.stroke();
  drawStar(ctx, 2, -41, 5, 6, 2.6, '#ffffff', '#7f1d1d');

  // Perna dianteira articulada
  ctx.save();
  ctx.translate(2, -30);
  drawArticulatedLeg(frontHip, frontKnee, '#1e293b', false);
  ctx.restore();

  // Cabeça expressiva + boné vermelho
  ctx.save();
  ctx.translate(2, -64);
  ctx.fillStyle = '#fdba74';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Olho determinado + sobrancelha brava
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4.5, -1, 2.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(5.3, -1, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, -5.5);
  ctx.lineTo(8, -3.5);
  ctx.stroke();

  // Boca gritando
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(4.8, 4.5, 2.8, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boné vermelho com aba para frente
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(0, -2.5, 10.2, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(0, -4.5, 14.5, 3);
  ctx.strokeRect(0, -4.5, 14.5, 3);
  ctx.restore();

  // Braço dianteiro com Megafone (líder) ou Bandeira Vermelha (segundo)
  ctx.save();
  ctx.translate(2, -49);
  if (withFlag) {
    ctx.rotate(-0.22 + Math.sin(cycle) * 0.14);
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.roundRect(-3, 0, 14, 7.5, 3.5);
    ctx.fill();
    ctx.stroke();

    // Mastro + Bandeira Vermelha tremulando
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(-4, -44);
    ctx.stroke();

    const wave = Math.sin(cycle * 1.35) * 3.8;
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4, -44);
    ctx.quadraticCurveTo(-19, -46 + wave, -32, -40 - wave);
    ctx.lineTo(-29, -21 - wave);
    ctx.quadraticCurveTo(-17, -25 + wave, -1, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawStar(ctx, -17, -33, 5, 5.2, 2.3, '#ffffff', '#7f1d1d');
  } else {
    ctx.rotate(-0.32 - stride * 0.18);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.roundRect(0, -3.5, 14, 7.5, 3.5);
    ctx.fill();
    ctx.stroke();

    // Megafone branco e vermelho
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.lineTo(26, -9);
    ctx.lineTo(26, 7);
    ctx.lineTo(12, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(24, -9, 3.2, 16);
  }
  ctx.restore();

  ctx.restore();
}

export function drawPursuer() {
  if (state.gameState !== 'PLAYING' && state.gameState !== 'START' && state.gameState !== 'IMPACT' && state.gameState !== 'GAMEOVER') return;
  const activeGap = state.gameState === 'START' ? 58 : state.pursuerVisualGap;
  const minBehind = state.currentAct === 2 ? 86 : 48;
  const maxBehind = state.currentAct === 2 ? Math.min(170, player.x - 58) : Math.min(165, player.x - 62);
  const baseX = Math.max(54, player.x - (minBehind + (activeGap / 100) * Math.max(18, maxBehind - minBehind)));
  const dangerClose = (state.gameState === 'PLAYING' || state.gameState === 'IMPACT') && state.currentAct < 3 && state.pursuerGap <= 34;

  ctx.save();
  if (state.currentAct === 1) {
    // Trio de perseguidores anime correndo na margem esquerda do Planalto
    const thirdX = Math.max(18, baseX - 84);
    if (thirdX < baseX - 46) {
      drawPursuerRunner(thirdX, state.pursuerStep + 2.7, true);
    }

    const flagX = Math.max(28, baseX - 44);
    drawPursuerRunner(flagX, state.pursuerStep + 1.5, true);

    // Líder perseguidor na frente com Megafone
    drawPursuerRunner(baseX, state.pursuerStep, false);

    if (dangerClose) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(baseX - 38, state.groundY - 102, 84, 19, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 8.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEM ANISTIA!', baseX + 4, state.groundY - 90);
    }
  } else if (state.currentAct === 2) {
    // Picape / Trio Elétrico Vermelho da Esquerda colado atrás na pista de asfalto
    const truckX = baseX - 28;
    const bounce = Math.sin(player.wheelAngle * 2) * 1.25;
    const nowT = performance.now();
    const tod = getTimeOfDayState();

    // Sombra sólida na pista (alinhada com a faixa do carro executivo)
    ctx.save();
    ctx.translate(truckX, state.groundY + 10);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.translate(truckX, state.groundY - 4 + bounce);

    // Feixe do farol dianteiro agressivo no asfalto
    const beamLen = 105 + tod * 45;
    const beamGrad = ctx.createLinearGradient(54, -12, beamLen, -3);
    beamGrad.addColorStop(0, `rgba(254, 240, 138, ${0.34 + tod * 0.28})`);
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(54, -17);
    ctx.lineTo(beamLen, -28);
    ctx.lineTo(beamLen, 7);
    ctx.lineTo(54, -7);
    ctx.closePath();
    ctx.fill();

    // Bandeira vermelha traseira esvoaçante no vento
    const flagWave = Math.sin(nowT * 0.018) * 3.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-50, -24);
    ctx.lineTo(-54, -56);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-54, -56);
    ctx.quadraticCurveTo(-69, -58 + flagWave, -82, -52 - flagWave * 0.5);
    ctx.lineTo(-80, -39 - flagWave * 0.4);
    ctx.quadraticCurveTo(-67, -43 + flagWave, -53, -41);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Carroceria SUV / Picape vermelha metálica esculpida
    const redGrad = ctx.createLinearGradient(0, -44, 0, 2);
    redGrad.addColorStop(0, '#f87171');
    redGrad.addColorStop(0.32, '#dc2626');
    redGrad.addColorStop(0.78, '#991b1b');
    redGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = redGrad;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-56, -2);
    ctx.lineTo(-55, -24);
    ctx.lineTo(-42, -26);
    ctx.lineTo(-22, -41);
    ctx.lineTo(20, -41);
    ctx.lineTo(35, -23);
    ctx.lineTo(54, -19);
    ctx.quadraticCurveTo(58, -9, 55, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Para-choques reforçados + estribo lateral + quebra-mato dianteiro
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-58, -6, 12, 6, 2);
    ctx.roundRect(47, -6, 12, 6, 2);
    ctx.roundRect(-24, -2, 48, 3.5, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(55, -17);
    ctx.lineTo(60, -16);
    ctx.lineTo(60, -3);
    ctx.stroke();

    // Cabine com vidro escuro + motorista de boné vermelho ao volante
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-26, -23);
    ctx.lineTo(-19, -37);
    ctx.lineTo(17, -37);
    ctx.lineTo(30, -23);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.roundRect(3, -29, 13, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.arc(10, -31, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(10, -33.5, 4.7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(10, -34.5, 7, 2);

    // Vidro translúcido com reflexo diagonal e coluna
    ctx.fillStyle = 'rgba(186, 230, 253, 0.32)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-26, -23);
    ctx.lineTo(-19, -37);
    ctx.lineTo(17, -37);
    ctx.lineTo(30, -23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2, -37, 3.5, 14);

    // Retrovisor lateral
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(23, -25, 6, 4.5, 1.5);
    ctx.fill();
    ctx.stroke();

    // Faixa branca lateral com estrela e letreiro "ESQUERDA"
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-49, -15, 96, 2.5);
    drawStar(ctx, -18, -14, 5, 6.2, 2.8, '#ffffff', '#7f1d1d');
    ctx.fillStyle = '#fef2f2';
    ctx.font = '900 7.6px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ESQUERDA', 12, -13.5);

    // Caixa de som e par de cornetas cromadas no rack do teto
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-21, -49, 25, 8, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-19, -47, 7, 4);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-9, -47, 10, 4);

    for (const hornY of [-53, -45]) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(4, hornY + 2);
      ctx.lineTo(20, hornY - 4);
      ctx.lineTo(20, hornY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(18, hornY - 2.5, 2.5, 7);
    }

    // Ondas sonoras pulsando das cornetas em direção ao jogador
    const soundPulse = Math.floor(nowT * 0.014) % 2 === 0;
    ctx.strokeStyle = dangerClose ? 'rgba(248, 113, 113, 0.88)' : 'rgba(254, 240, 138, 0.65)';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(23, -48, soundPulse ? 13 : 8, -0.55, 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(23, -48, soundPulse ? 20 : 14, -0.5, 0.5);
    ctx.stroke();

    // Faróis dianteiros e lanterna traseira
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.roundRect(48, -16, 7, 5.5, 1.8);
    ctx.fill();
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(46, -11, 5, 2.5);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-55, -18, 5, 7, 1.5);
    ctx.fill();

    // Arcos de roda + pneus off-road + aros giratórios alinhados em groundY + 8
    for (const wx of [-32, 31]) {
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(wx, 0, 14.5, Math.PI, 0);
      ctx.fill();

      ctx.save();
      ctx.translate(wx, 0);
      ctx.rotate(player.wheelAngle);
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) {
        const a = (r * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -6.2, Math.sin(a) * -6.2);
        ctx.lineTo(Math.cos(a) * 6.2, Math.sin(a) * 6.2);
        ctx.stroke();
      }
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (state.gameState === 'PLAYING' || state.gameState === 'IMPACT') {
    // Avião perseguidor da FAB no Ato 3: evolui com o tempo (Tucano -> F-5M -> Jato Gripen)
    const t = state.endlessFlightSeconds;
    const stage = t >= 45 ? 3 : t >= 20 ? 2 : 1;
    const nowT = performance.now();
    const behind = stage === 1 ? 154 : stage === 2 ? 136 : 118;
    const px = Math.max(56, player.x - behind);
    const py = Math.max(ceilingY + 46, Math.min(state.groundY - 58, player.y - 24 + Math.sin(t * (2.2 + stage * 0.4)) * 10));
    const pitch = Math.max(-0.22, Math.min(0.22, (player.y - py) * 0.0025));

    ctx.translate(px, py);
    ctx.rotate(pitch);

    if (stage === 1) {
      // FASE 1: Embraer A-29 Super Tucano (FAB) — turboélice camuflado
      // Leme vertical com bandeira/cores FAB
      ctx.fillStyle = '#365314';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -2);
      ctx.lineTo(-40, -22);
      ctx.lineTo(-22, -21);
      ctx.lineTo(-14, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-35, -17, 10, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-33, -13, 8, 2.5);

      // Fuselagem verde-oliva camuflada + barriga cinza
      const tucanoGrad = ctx.createLinearGradient(0, -12, 0, 12);
      tucanoGrad.addColorStop(0, '#4d7c0f');
      tucanoGrad.addColorStop(0.55, '#3f6212');
      tucanoGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = tucanoGrad;
      ctx.beginPath();
      ctx.moveTo(-34, 2);
      ctx.lineTo(-18, -8);
      ctx.lineTo(18, -8);
      ctx.quadraticCurveTo(36, -5, 38, 1);
      ctx.quadraticCurveTo(36, 9, 16, 10);
      ctx.lineTo(-24, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canopy em tandem (2 pilotos FAB)
      ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
      ctx.beginPath();
      ctx.ellipse(2, -9, 14, 5.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-3, -10, 2.6, 0, Math.PI * 2);
      ctx.arc(6, -10, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Asa reta + cocar da FAB
      ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(-14, 17);
      ctx.lineTo(6, 17);
      ctx.lineTo(14, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(-11, 1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(-11, 1, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Spinner + Hélice frontal girando
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(38, 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const bladeH = 16 * Math.abs(Math.sin(nowT * 0.065)) + 3;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(40, 1 - bladeH);
      ctx.lineTo(40, 1 + bladeH);
      ctx.stroke();
    } else if (stage === 2) {
      // FASE 2: Caça F-5M Tiger II (FAB) — supersônico intermediário
      // Pós-combustor laranja
      const flameLen = 24 + Math.sin(nowT * 0.05) * 6;
      const flameGrad = ctx.createLinearGradient(-34, 2, -34 - flameLen, 2);
      flameGrad.addColorStop(0, '#fef08a');
      flameGrad.addColorStop(0.5, '#f97316');
      flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-34, -3);
      ctx.lineTo(-34 - flameLen, 2);
      ctx.lineTo(-34, 7);
      ctx.closePath();
      ctx.fill();

      // Leme alto FAB
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -2);
      ctx.lineTo(-40, -24);
      ctx.lineTo(-24, -23);
      ctx.lineTo(-14, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-35, -19, 9, 3.5);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-33, -15.5, 8, 2.5);

      // Fuselagem cinza tático afilada
      const f5Grad = ctx.createLinearGradient(0, -10, 0, 10);
      f5Grad.addColorStop(0, '#cbd5e1');
      f5Grad.addColorStop(0.6, '#64748b');
      f5Grad.addColorStop(1, '#334155');
      ctx.fillStyle = f5Grad;
      ctx.beginPath();
      ctx.moveTo(-35, 3);
      ctx.lineTo(-26, -7);
      ctx.lineTo(14, -7);
      ctx.lineTo(44, 1);
      ctx.lineTo(14, 9);
      ctx.lineTo(-35, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Nariz radome escuro + cabine bolha
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(31, -2.5);
      ctx.lineTo(44, 1);
      ctx.lineTo(31, 4.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
      ctx.beginPath();
      ctx.ellipse(10, -7.5, 11, 4.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Asa enflechada + míssil na ponta
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(-20, 16);
      ctx.lineTo(2, 16);
      ctx.lineTo(14, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // FASE 3: Jato F-39 Gripen NG (FAB) — interceptação máxima
      // Pós-combustor azul-branco supersônico + cone de choque
      const flameLen = 38 + Math.sin(nowT * 0.08) * 9;
      const jetGrad = ctx.createLinearGradient(-36, 2, -36 - flameLen, 2);
      jetGrad.addColorStop(0, '#ffffff');
      jetGrad.addColorStop(0.4, '#38bdf8');
      jetGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = jetGrad;
      ctx.beginPath();
      ctx.moveTo(-36, -4);
      ctx.lineTo(-36 - flameLen, 2);
      ctx.lineTo(-36, 8);
      ctx.closePath();
      ctx.fill();

      // Leme furtivo FAB
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, -3);
      ctx.lineTo(-42, -26);
      ctx.lineTo(-24, -25);
      ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-36, -21, 9, 3.5);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-34, -17.5, 8, 2.5);

      // Fuselagem delta cinza-furtivo
      const gripenGrad = ctx.createLinearGradient(0, -12, 0, 12);
      gripenGrad.addColorStop(0, '#94a3b8');
      gripenGrad.addColorStop(0.55, '#475569');
      gripenGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = gripenGrad;
      ctx.beginPath();
      ctx.moveTo(-36, 3);
      ctx.lineTo(-26, -8);
      ctx.lineTo(18, -7);
      ctx.lineTo(48, 1);
      ctx.lineTo(16, 9);
      ctx.lineTo(-36, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canards dianteiros característicos do Gripen
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(6, -12);
      ctx.lineTo(16, -10);
      ctx.lineTo(24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Asa em delta
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-26, 4);
      ctx.lineTo(-22, 19);
      ctx.lineTo(10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canopy dourada furtiva
      ctx.fillStyle = 'rgba(250, 204, 21, 0.72)';
      ctx.beginPath();
      ctx.ellipse(16, -6.5, 11, 4.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
    }

    // Etiqueta discreta da aeronave FAB
    ctx.rotate(-pitch);
    ctx.font = '900 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = stage === 3 ? '#38bdf8' : stage === 2 ? '#fbbf24' : '#a3e635';
    const fabLabel = stage === 3 ? 'FAB • F-39 GRIPEN' : stage === 2 ? 'FAB • CAÇA F-5M' : 'FAB • TUCANO';
    ctx.fillText(fabLabel, 0, 29);
  }
  ctx.restore();
}

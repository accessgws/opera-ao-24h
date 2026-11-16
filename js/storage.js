// =============================================================================
// PERSISTÊNCIA (LOCALSTORAGE), MISSÕES E GARAGEM DE UPGRADES
// =============================================================================

import { STORAGE_KEY, STORAGE_MUSIC_KEY, STORAGE_MUTE_KEY, STORAGE_TOUCH_MODE_KEY, MISSION_TEMPLATES, STORAGE_STARS_KEY, STORAGE_UPGRADES_KEY, UPGRADE_DEFS, STORAGE_MISSIONS_KEY } from './config.js';
import { state, upgrades, missionsState } from './state.js';

export function loadSettings() {
  state.highScore = 0;
  try {
    state.highScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
    if (localStorage.getItem(STORAGE_MUSIC_KEY) === '0') {
      state.musicEnabled = false;
    }
    if (localStorage.getItem(STORAGE_MUTE_KEY) === '1') {
      state.mutedPreference = true;
    }
    const savedTouch = localStorage.getItem(STORAGE_TOUCH_MODE_KEY);
    if (savedTouch === 'swipe' || savedTouch === 'split') {
      state.touchControlMode = savedTouch;
    }
  } catch (e) {
    state.highScore = 0;
  }
}

export function createMissionSlot(template, tierIndex) {
  const tier = Math.max(0, Math.min(template.targets.length - 1, tierIndex));
  const target = template.targets[tier];
  return {
    type: template.type,
    perRun: template.perRun,
    label: template.makeLabel(target),
    target,
    progress: 0,
    reward: template.rewards[tier],
    done: false
  };
}

export function buildDefaultMissions() {
  return [
    createMissionSlot(MISSION_TEMPLATES[0], 0),
    createMissionSlot(MISSION_TEMPLATES[1], 0),
    createMissionSlot(MISSION_TEMPLATES[2], 0)
  ];
}

export function pickReplacementMission(activeSlots, completedCount) {
  const usedTypes = new Set(activeSlots.map((s) => s.type));
  const candidates = MISSION_TEMPLATES.filter((t) => !usedTypes.has(t.type));
  const pool = candidates.length > 0 ? candidates : MISSION_TEMPLATES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const tier = Math.min(2, Math.floor((completedCount + 1) / 3));
  return createMissionSlot(picked, tier);
}

export function loadProgressState() {
  try {
    const savedStars = parseInt(localStorage.getItem(STORAGE_STARS_KEY) || '0', 10);
    state.totalStars = Number.isFinite(savedStars) && savedStars >= 0 ? savedStars : 0;

    const rawUpgrades = localStorage.getItem(STORAGE_UPGRADES_KEY);
    if (rawUpgrades) {
      const parsed = JSON.parse(rawUpgrades);
      for (const def of UPGRADE_DEFS) {
        const lvl = parseInt(parsed && parsed[def.id], 10);
        upgrades[def.id] = Number.isFinite(lvl) ? Math.max(0, Math.min(3, lvl)) : 0;
      }
    }

    const rawMissions = localStorage.getItem(STORAGE_MISSIONS_KEY);
    if (rawMissions) {
      const parsedM = JSON.parse(rawMissions);
      if (parsedM && Array.isArray(parsedM.slots) && parsedM.slots.length === 3) {
        missionsState.completedCount = Math.max(0, parseInt(parsedM.completedCount || '0', 10) || 0);
        missionsState.slots = parsedM.slots.map((s, idx) => {
          const tpl = MISSION_TEMPLATES.find((t) => t.type === s.type) || MISSION_TEMPLATES[idx];
          const target = Number(s.target) > 0 ? Number(s.target) : tpl.targets[0];
          const progress = Math.max(0, Math.min(target, Number(s.progress) || 0));
          return {
            type: tpl.type,
            perRun: tpl.perRun,
            label: typeof s.label === 'string' && s.label ? s.label : tpl.makeLabel(target),
            target,
            progress,
            reward: Number(s.reward) > 0 ? Number(s.reward) : tpl.rewards[0],
            done: Boolean(s.done) || progress >= target
          };
        });
      }
    }
  } catch (e) {}

  if (missionsState.slots.length !== 3) {
    missionsState.slots = buildDefaultMissions();
  }
}

export function saveProgressState() {
  try {
    localStorage.setItem(STORAGE_STARS_KEY, String(Math.max(0, Math.floor(state.totalStars))));
    localStorage.setItem(STORAGE_UPGRADES_KEY, JSON.stringify(upgrades));
    localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(missionsState));
  } catch (e) {}
}

export function getMagnetRadius() {
  const radii = [0, 130, 210, 295];
  return radii[upgrades.magnet] || 0;
}

export function getCoffeeFreezeDuration() {
  const durations = [4.0, 5.2, 6.4, 7.8];
  return durations[upgrades.coffeeBoost] || 4.0;
}

export function getTurboDuration() {
  const durations = [3.5, 4.6, 5.8, 7.2];
  return durations[upgrades.turboBoost] || 3.5;
}

export function getShieldPostInvuln() {
  const invulns = [1.0, 1.0, 1.6, 2.2];
  return invulns[upgrades.startShield] || 1.0;
}

export function getVehicleSpeedMultiplier() {
  const fleetBonus = [1.0, 1.12, 1.24, 1.38][upgrades.vehicleTier] || 1.0;
  const engineBonus = [0, 0.06, 0.12, 0.20][upgrades.turboBoost] || 0;
  return fleetBonus + engineBonus;
}

export function getAvailableUpgradeCount() {
  let count = 0;
  for (const def of UPGRADE_DEFS) {
    const lvl = upgrades[def.id] || 0;
    if (lvl < 3 && state.totalStars >= def.costs[lvl]) count += 1;
  }
  return count;
}

export function resetPerRunMissions() {
  for (const slot of missionsState.slots) {
    if (slot.perRun && !slot.done) {
      slot.progress = 0;
    }
  }
}

export function rollCompletedMissions() {
  let changed = false;
  const nextSlots = [...missionsState.slots];
  for (let i = 0; i < nextSlots.length; i++) {
    if (nextSlots[i].done) {
      const others = nextSlots.filter((_, idx) => idx !== i);
      nextSlots[i] = pickReplacementMission(others, missionsState.completedCount);
      changed = true;
    }
  }
  missionsState.slots = nextSlots;
  if (changed) saveProgressState();
}

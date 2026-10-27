/**
 * Translates raw controller stick inputs into vehicle movement intents,
 * accounting for vehicle class mechanics and the 32-in-1 cartridge's
 * alternative biplane wiring.
 */
import type { Intent, StickInput, VehicleClass } from './types.ts';

/**
 * What a stick means for a vehicle. Tanks and jets: x turns (right = clockwise), y up drives (tank) or
 * burns (jet: up fast, down slow). Biplanes and the bomber, standard: the same as jets.
 * Biplanes and the bomber with `wiring` (the 32-in-1 cartridge): y turns (up = clockwise, down =
 * anticlockwise) and x sets the speed (right fast, left slow).
 */
export function intentFor(
  stick: StickInput,
  vehicle: VehicleClass,
  wiring: boolean,
  reverseGear = false,
): Intent {
  const fire = stick.fire;

  // Tanks drive forward on y up and turn on x. Pulling back only stops them, as in 1977, unless the
  // Reverse gear setting lets them back away.
  if (vehicle === 'tank') {
    return {
      turn: stick.x,
      throttle: stick.y === 1 ? 1 : stick.y === -1 && reverseGear ? -1 : 0,
      fire,
    };
  }

  // Jets use standard flight axes: x steers and y controls throttle tiers
  if (vehicle === 'jet') {
    return {
      turn: stick.x,
      throttle: stick.y,
      fire,
    };
  }

  // The 32-in-1 cartridge swapped the biplane and bomber potentiometer axes
  if (wiring) {
    return {
      turn: stick.y,
      throttle: stick.x,
      fire,
    };
  }

  return {
    turn: stick.x,
    throttle: stick.y,
    fire,
  };
}

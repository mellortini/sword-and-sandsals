/**
 * Icons for the medallions of the skill trees and the Hall of Fame: flat cut-paper shapes with a dark ink outline,
 * drawn as SVG (64 x 64) so they stay sharp at any size. One entry per skill and per achievement: the medallion's
 * colour and the picture on it.
 */
import type { Achievement } from '../core/achievements';
import type { SkillId } from '../data/skills';

const INK = '#3a2018';
const STEEL = '#dfe3e8';
const STEEL_D = '#9aa3ad';
const GOLD = '#f2bd45';
const GOLD_D = '#c8892a';
const CREAM = '#f7e6bf';
const SKIN = '#f0c690';
const LEATHER = '#a0622f';
const LEATHER_D = '#6b3d1c';
const RED = '#d2452f';
const RED_D = '#962a1d';
const BLUE = '#4d86a8';
const NAVY = '#28406a';
const GREEN = '#7da35a';

/** a filled shape with the ink line round it */
const shape = (d: string, fill: string, width = 2.6) =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string, width = 2.6) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${width}"/>`;
/** a plain line */
const line = (d: string, colour = INK, width = 2.6) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
/** a thick paper strip (limbs, handles): ink underneath, colour on top */
const strip = (d: string, colour: string, width = 5) => line(d, INK, width + 4) + line(d, colour, width);
const move = (inner: string, transform: string) => `<g transform="${transform}">${inner}</g>`;
const text = (s: string, x: number, y: number, size: number, fill = INK) =>
  `<text x="${x}" y="${y}" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="${size}" text-anchor="middle" fill="${fill}">${s}</text>`;

// ------------------------------------------------------------------ shared motifs
/** upright sword, point up, centred on (32, 32) */
const sword = (blade = STEEL) =>
  shape('M32 7 L37 15 L37 40 L27 40 L27 15 Z', blade) + line('M32 15 L32 38', STEEL_D, 2)
  + shape('M20 40 H44 V45 H20 Z', GOLD) + shape('M29 45 H35 V53 H29 Z', LEATHER) + circle(32, 55.5, 3.6, GOLD);
const tilted = (inner: string, deg: number, scale = 1) => move(inner, `translate(32 32) rotate(${deg}) scale(${scale}) translate(-32 -32)`);
const crossed = () => tilted(sword(), -45, 0.98) + tilted(sword(), 45, 0.98);

const heater = 'M32 9 L51 15 V31 C51 43 43 51 32 56 C21 51 13 43 13 31 V15 Z';
const shield = (left: string, right: string) =>
  shape(heater, left) + `<path d="M32 10.5 L49.5 16 V31 C49.5 42 42.500 49.500 32 54.500 Z" fill="${right}"/>` + line(heater);

const heart = (fill = RED) => shape('M32 53 C18 43 10 35 10 25 C10 17 16 12 22 12 C27 12 31 15 32 19 C33 15 37 12 42 12 C48 12 54 17 54 25 C54 35 46 43 32 53 Z', fill)
  + line('M17 24 C17 20 19 18 23 18', '#ffffff80', 3);

const flame = () => shape('M33 7 C36 18 50 24 50 39 C50 49 42 56 32 56 C22 56 14 49 14 39 C14 31 19 27 21 20 C25 24 26 28 26 31 C30 25 33 17 33 7 Z', '#f08a2c')
  + shape('M32 29 C35 36 42 39 42 46 C42 52 37 55 32 55 C27 55 22 52 22 46 C22 40 29 37 32 29 Z', '#ffd45e', 2);

const star = (cx: number, cy: number, outer: number, inner: number, points: number, fill: string) => {
  const d = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer, a = (Math.PI * i) / points - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return shape(`M${d.join(' L')} Z`, fill);
};

/** two laurel branches around the middle */
const laurel = (leaf = GREEN) => {
  const side = [[20, 50, 40], [13.500, 42, 15], [12, 32, -8], [15, 22, -32], [21, 14.500, -52]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="7.500" transform="rotate(${r} ${x} ${y})" fill="${leaf}" stroke="${INK}" stroke-width="2"/>`).join('');
  return line('M28 55 C14 48 10 32 21 13', LEATHER_D) + side + move(line('M28 55 C14 48 10 32 21 13', LEATHER_D) + side, 'translate(64 0) scale(-1 1)');
};

const helmet = (metal: string, crest: string) =>
  shape('M22 20 C24 6 46 6 50 20 L44 19 C40 13 28 13 27 20 Z', crest)
  + shape('M14 40 C14 24 22 17 32 17 C42 17 50 24 50 40 L50 44 L40 44 L38 54 L26 54 L24 44 L14 44 Z', metal)
  + shape('M23 33 H41 V39 H35 L34 47 H30 L29 39 H23 Z', INK, 1);

const cuirass = (metal = STEEL) =>
  shape('M20 11 L27 14 C29 17 35 17 37 14 L44 11 L54 21 L47 27 L46 52 C38 56 26 56 18 52 L17 27 L10 21 Z', metal)
  + line('M21 33 C26 36 38 36 43 33 M21 41 C26 44 38 44 43 41 M32 22 V52', STEEL_D, 2.400);

const head = (cx: number, cy: number) => circle(cx, cy, 6, SKIN);

const hand = () => shape('M24 56 L22 40 L15 31 C13 27 17 25 20 28 L25 33 L25 14 C25 10 30 10 30 14 L31 28 L32 11 C32 7 37 7 37 11 L37 28 L39 14 C39 10 44 10 44 14 L43 31 L47 23 C49 20 53 22 51 26 L46 43 L43 56 Z', SKIN);

const speaker = () => shape('M17 55 V45 C11 41 9 34 10 28 C11 16 20 10 28 10 C38 10 43 18 42 26 L47 34 L42 36 L43 40 L39 42 L41 45 C40 49 36 50 31 49 L31 55 Z', SKIN)
  + circle(33, 25, 2, INK, 0) + line('M50 34 C53 37 53 42 50 45 M55 30 C60 35 60 45 55 49', CREAM, 3);

const wolf = () => shape('M12 10 L24 20 C28 18 36 18 40 20 L52 10 L50 28 L55 38 L45 41 L38 54 L32 57 L26 54 L19 41 L9 38 L14 28 Z', '#8d6a4c')
  + shape('M22 38 L32 33 L42 38 L36 52 L32 55 L28 52 Z', CREAM, 2) + shape('M28 46 H36 L32 51 Z', INK, 1)
  + line('M20 29 L27 32 M44 29 L37 32', INK, 3.400);

const quillAndInk = () => shape('M18 34 H42 L45 40 V52 C45 55 42 57 39 57 H21 C18 57 15 55 15 52 V40 Z', NAVY) + shape('M22 28 H38 V34 H22 Z', LEATHER)
  + shape('M30 31 C30 20 38 9 55 6 C55 18 47 27 36 29 Z', CREAM) + line('M30 31 L49 12', LEATHER_D, 2);

const curtains = () => shape('M9 10 H55 V16 H9 Z', GOLD) + shape('M11 16 H29 C28 30 22 40 12 44 V54 H11 Z', RED) + shape('M53 16 H35 C36 30 42 40 52 44 V54 H53 Z', RED)
  + star(32, 38, 10, 4, 6, GOLD);

const boot = () => shape('M28 12 H44 V36 C44 40 55 40 56 48 V53 H26 V38 L28 30 Z', LEATHER) + shape('M26 49 H56 V54 H26 Z', LEATHER_D)
  + line('M30 19 H42 M30 26 H42', CREAM, 2.200) + shape('M29 29 C20 31 11 27 8 18 C14 20 17 19 18 18 C13 16 11 12 11 9 C21 11 29 17 29 29 Z', CREAM);

const runner = () => strip('M33 24 L28 38', SKIN, 7) + strip('M28 38 L40 44 L37 55', SKIN) + strip('M28 38 L20 48 L10 47', SKIN)
  + strip('M33 27 L43 32 L51 25', SKIN, 4) + strip('M33 27 L22 25 L16 33', SKIN, 4) + head(40, 14);

const hourglass = () => shape('M19 15 H45 C45 24 36 28 35 32 C36 36 45 40 45 49 H19 C19 40 28 36 29 32 C28 28 19 24 19 15 Z', '#d8ecef')
  + shape('M24 22 H40 C38 26 34 28 32 31 C30 28 26 26 24 22 Z', GOLD, 1.500) + shape('M23 49 C25 43 29 41 32 40 C35 41 39 43 41 49 Z', GOLD, 1.500)
  + shape('M15 8 H49 V15 H15 Z', LEATHER) + shape('M15 49 H49 V56 H15 Z', LEATHER);

const tumbler = () => line('M12 40 C8 22 24 8 40 12', CREAM, 3) + line('M34 7 L42 12.500 L35 18', CREAM, 3)
  + strip('M25 37 C27 25 42 22 47 32', NAVY, 9) + strip('M25 38 L36 44 L28 54', NAVY) + strip('M46 33 L50 44 L42 52', NAVY, 4) + head(51, 25);

const brawler = () => strip('M29 24 V38', CREAM, 9) + strip('M29 38 L20 55', CREAM) + strip('M29 38 L40 45 L40 56', CREAM)
  + strip('M30 27 L41 29 L53 24', CREAM, 4) + strip('M28 27 L17 33 L21 41', CREAM, 4) + head(29, 13) + circle(54, 24, 4, SKIN);

const maskFace = () => shape('M11 14 C22 18 42 18 53 14 C56 32 48 53 32 56 C16 53 8 32 11 14 Z', GOLD)
  + shape('M18 28 C21 23 27 24 29 29 C25 31 21 31 18 28 Z M46 28 C43 23 37 24 35 29 C39 31 43 31 46 28 Z', INK, 1.500)
  + shape('M20 39 C27 43 37 43 44 39 C42 49 22 49 20 39 Z', CREAM);

const drop = (fill: string) => shape('M32 7 C40 20 49 29 49 40 C49 49 41 56 32 56 C23 56 15 49 15 40 C15 29 24 20 32 7 Z', fill)
  + line('M23 40 C23 45 26 48 29 49', '#ffffff70', 3.400);

const wand = () => strip('M14 52 L40 24', LEATHER, 4) + star(44, 19, 11, 4.500, 5, GOLD) + circle(21, 19, 3, CREAM, 2) + circle(51, 42, 3.500, CREAM, 2) + circle(32, 12, 2.200, CREAM, 1.800);

const cat = () => shape('M11 45 C11 30 24 24 36 28 C49 31 56 39 54 47 C52 55 40 56 26 55 C15 55 11 51 11 45 Z', '#e0a45c')
  + shape('M10 40 L12 25 L19 31 L27 29 L33 23 L34 38 C34 49 12 50 10 40 Z', '#eab672')
  + line('M15 39 L20 40 M25 40 L30 39 M54 45 C48 56 30 55 25 49', INK, 2.400) + text('z', 45, 22, 14, CREAM) + text('z', 53, 13, 10, CREAM);

const pouncer = () => shape('M7 36 C13 32 18 32 24 28 C31 22 40 21 46 22 L49 14 L53 22 L59 28 L52 33 L47 32 L50 40 L58 44 L55 48 L43 41 C38 40 33 41 29 40 L22 48 L12 53 L11 48 L19 41 L17 38 L8 41 Z', '#5a3524')
  + circle(51, 25, 1.800, GOLD, 0) + line('M6 24 H18 M9 17 H25', CREAM, 3);

const paw = () => shape('M32 30 C42 30 50 41 47 49 C45 55 38 52 32 52 C26 52 19 55 17 49 C14 41 22 30 32 30 Z', CREAM)
  + [[15, 28, -25], [25, 16, -8], [39, 16, 8], [49, 28, 25]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="5.500" ry="7.500" transform="rotate(${r} ${x} ${y})" fill="${CREAM}" stroke="${INK}" stroke-width="2.600"/>`).join('');

const guardedHeart = () => move(heart(), 'translate(-5 0) scale(0.92)') + move(shield(STEEL, STEEL_D), 'translate(27 25) scale(0.6)');
const bleedingSword = () => tilted(sword(), 45) + shape('M46 31 C51 38 54 42 54 46 C54 55 38 55 38 46 C38 42 41 38 46 31 Z', RED) + circle(54, 30, 3, RED, 2);

// ------------------------------------------------------------------ achievements only
const wreathNumber = (s: string, leaf = GREEN) => laurel(leaf) + text(s, 32, 39, s.length > 2 ? 15 : 20, CREAM);
const brokenSword = () => tilted(shape('M27 40 L27 28 L31 32 L33 25 L37 29 L37 40 Z', STEEL) + shape('M20 40 H44 V45 H20 Z', GOLD) + shape('M29 45 H35 V53 H29 Z', LEATHER) + circle(32, 55.500, 3.600, GOLD), -18)
  + shape('M38 8 L47 13 L50 24 L44 21 L40 24 L37 17 Z', STEEL);
const openGuard = () => shield(STEEL, STEEL_D) + line('M16 14 L48 50', RED, 6);
const feather = () => shape('M14 54 C14 30 30 10 54 8 C54 32 40 48 20 50 Z', CREAM) + line('M10 58 L46 18', LEATHER_D, 2.600) + line('M24 40 L22 31 M32 31 L31 22 M30 41 L40 40', GOLD_D, 2);
const burst = () => star(32, 32, 27, 13, 9, GOLD) + star(32, 32, 13, 6, 7, CREAM);
const bullseye = () => circle(32, 32, 24, CREAM) + circle(32, 32, 16, RED, 2) + circle(32, 32, 8, CREAM, 2) + circle(32, 32, 3, RED, 1.500)
  + strip('M33 31 L53 11', LEATHER, 3) + shape('M49 9 L57 7 L55 15 Z', GOLD, 2);
const wall = () => move(shield(RED, RED_D), 'translate(0 8) scale(0.7)') + move(shield(BLUE, NAVY), 'translate(19.500 8) scale(0.7)') + move(shield(GOLD, GOLD_D), 'translate(10 14) scale(0.7)');
const spearRush = () => line('M7 22 H20 M7 32 H17 M7 42 H22', CREAM, 3) + strip('M16 50 L44 20', LEATHER, 4) + shape('M56 7 L52 27 L46 23 L41 18 L36 12 Z', STEEL);
const horns = () => shape('M8 10 C8 26 18 30 24 28 L24 22 C18 22 13 18 8 10 Z M56 10 C56 26 46 30 40 28 L40 22 C46 22 51 18 56 10 Z', CREAM)
  + shape('M22 20 H42 L46 34 L38 54 H26 L18 34 Z', '#7a4a2c') + line('M25 33 L29 35 M39 33 L35 35', INK, 3.400) + shape('M27 46 H37 L36 54 H28 Z', SKIN, 2) + line('M29 59 C31 62 33 62 35 59', GOLD, 3);
const pennant = () => strip('M16 56 V10', LEATHER, 3) + shape('M18 10 L54 18 L40 26 L54 36 L18 34 Z', RED) + move(heart(CREAM), 'translate(19 13) scale(0.28)');
const ovation = () => move(hand(), 'translate(-4 14) rotate(-24 32 32) scale(0.72)') + move(hand(), 'translate(22 14) rotate(24 32 32) scale(0.72)') + star(32, 15, 10, 4.500, 5, GOLD);
const gift = () => shape('M13 30 H51 V55 H13 Z', RED) + shape('M10 21 H54 V31 H10 Z', '#e4603f') + shape('M28 21 H36 V55 H28 Z', GOLD)
  + shape('M32 21 C22 6 11 14 21 21 Z M32 21 C42 6 53 14 43 21 Z', GOLD);
const crackedHeart = () => heart() + line('M32 19 L26 29 L37 35 L29 44 L32 52', CREAM, 3.400);
const finishingAxe = () => shape('M10 44 H54 L50 56 H14 Z', LEATHER) + line('M20 48 V54 M33 48 V54 M45 48 V54', LEATHER_D, 2.400)
  + strip('M52 12 L30 40', '#8a5a34', 4) + shape('M24 24 L38 34 C37 42 31 47 22 47 C16 40 18 30 24 24 Z', STEEL);
const fullSet = () => move(cuirass(), 'translate(9 21) scale(0.72)') + move(helmet(GOLD, RED), 'translate(16 0) scale(0.5)');
const noRest = () => `<path d="M40 10 C26 12 18 24 20 35 C23 49 39 56 52 46 C36 46 26 28 40 10 Z" fill="${CREAM}" stroke="${INK}" stroke-width="2.600" stroke-linejoin="round"/>` + line('M12 12 L52 54', RED, 6);

export interface Medal {
  /** the disc behind the picture */
  readonly colour: string;
  readonly art: string;
}

const m = (colour: string, art: string): Medal => ({ colour, art });
const C = { red: '#b8473a', teal: '#4f8794', gold: '#bd9341', green: '#5f8a52', violet: '#4d4478', grey: '#7d6a60', blue: '#47789a', brown: '#9a5232' } as const;

export const SKILL_MEDALS: Readonly<Record<SkillId, Medal>> = {
  'keen-edge': m(C.red, tilted(sword(), 45)),
  'measured-strike': m(C.red, crossed()),
  riposte: m(C.red, shield(GOLD, STEEL_D)),
  'deadly-edge': m(C.red, bleedingSword()),
  brace: m(C.teal, shield('#e59a52', '#b96a30')),
  'layered-guard': m(C.teal, cuirass()),
  'iron-heart': m(C.teal, heart()),
  unshaken: m(C.teal, brawler()),
  'fleet-footed': m(C.gold, boot()),
  'long-leap': m(C.gold, runner()),
  'economy-of-motion': m(C.gold, hourglass()),
  'evasive-roll': m(C.gold, tumbler()),
  'stage-presence': m(C.red, maskFace()),
  'opening-act': m(C.violet, curtains()),
  'cutting-wit': m(C.green, speaker()),
  'stage-courage': m(C.grey, guardedHeart()),
  'ink-study': m(C.blue, quillAndInk()),
  'deep-ink': m(C.blue, drop(NAVY)),
  'focused-casting': m(C.green, wand()),
  firebreak: m(C.red, flame()),
  'wild-vigour': m(C.gold, wolf()),
  'den-rest': m(C.brown, cat()),
  'predator-charge': m(C.brown, pouncer()),
  'sure-paws': m(C.brown, paw()),
};

const ACHIEVEMENT_MEDALS: Readonly<Record<string, Medal>> = {
  'first-win': m(C.gold, laurel() + star(32, 31, 13, 5.500, 5, GOLD)),
  'ten-wins': m(C.gold, wreathNumber('X')),
  'fifty-wins': m(C.gold, wreathNumber('L', STEEL)),
  'hundred-wins': m(C.gold, wreathNumber('C', GOLD)),
  'first-loss': m(C.grey, brokenSword()),
  'ten-fights': m(C.grey, helmet(LEATHER, CREAM)),
  'fifty-fights': m(C.grey, helmet(STEEL, RED)),
  'level-thirty': m(C.brown, star(32, 33, 27, 18, 8, STEEL) + text('30', 32, 40, 19)),
  'level-sixty': m(C.brown, star(32, 33, 27, 18, 10, GOLD) + text('60', 32, 40, 19)),
  'high-favour': m(C.violet, pennant()),
  'max-favour': m(C.violet, ovation()),
  'first-gift': m(C.violet, gift()),
  'taunting-win': m(C.violet, speaker()),
  'first-critical': m(C.red, burst()),
  'twenty-criticals': m(C.red, bullseye()),
  'first-charge': m(C.red, spearRush()),
  'ten-charges': m(C.red, horns()),
  'first-block': m(C.teal, shield('#e59a52', '#b96a30')),
  'twenty-blocks': m(C.teal, wall()),
  'win-without-block': m(C.teal, openGuard()),
  'perfect-win': m(C.teal, feather()),
  'win-without-rest': m(C.green, noRest()),
  'close-win': m(C.green, crackedHeart()),
  'first-finisher': m(C.green, finishingAxe()),
  'full-set': m(C.green, fullSet()),
};

/** an achievement's medallion; a badge added later without its own picture gets the laurel */
export const achievementMedal = (id: Achievement['id']): Medal => ACHIEVEMENT_MEDALS[id] ?? m(C.gold, laurel() + star(32, 31, 13, 5.500, 5, GOLD));
export const hasAchievementMedal = (id: string) => id in ACHIEVEMENT_MEDALS;

const LOCK = `<svg class="medal__lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="${INK}" stroke-width="3"/>
  <rect x="4" y="10" width="16" height="12" rx="3" fill="${GOLD_D}" stroke="${INK}" stroke-width="2"/><path d="M12 14v4" stroke="${INK}" stroke-width="2.600" stroke-linecap="round"/></svg>`;

/** the round medallion with its picture and the small padlock (shown by CSS when the card is locked) */
export const medalHtml = (medal: Medal) =>
  `<span class="medal" style="--disc:${medal.colour}" aria-hidden="true"><svg class="medal__art" viewBox="0 0 64 64">${medal.art}</svg>${LOCK}</span>`;

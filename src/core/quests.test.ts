import { describe, expect, it } from 'vitest';
import { createCombat, performAction } from './combat';
import {
  BET_STAKES, QUESTS, acceptQuest, betCard, claimQuest, fightBet, placeBet, questReward, questState, recordQuestBout,
  tallyBout, tavernRumours,
} from './quests';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import { newStory } from './story';

const hero = (patch: Partial<SavedCharacter> = {}): SavedCharacter => ({
  name: 'Blank', level: 5, experience: 0, gold: 100, inventory: [], look: DEFAULT_LOOK,
  attributes: { might: 5, agility: 5, precision: 5, guard: 5, vitality: 5, stamina: 5, charm: 5, arcana: 5 },
  ...patch,
});

const win = { won: true, usedBlock: false, favour: 60, turns: 12 };

describe('tavern tasks (#65)', () => {
  it('offers three tasks, each taken, done by a matching win and paid once', () => {
    expect(QUESTS).toHaveLength(3);
    let c = acceptQuest(hero(), 'open-guard');
    expect(questState(c, 'open-guard')).toBe('accepted');
    expect(questState(c, 'quick-work')).toBe('open');

    // a loss or a bout with a block does not count; a win without one does
    expect(recordQuestBout(c, { ...win, won: false }).completed).toEqual([]);
    expect(recordQuestBout(c, { ...win, usedBlock: true }).completed).toEqual([]);
    const done = recordQuestBout(c, win);
    expect(done.completed.map((q) => q.id)).toEqual(['open-guard']);
    c = done.character;
    expect(questState(c, 'open-guard')).toBe('completed');

    const paid = claimQuest(c, 'open-guard');
    expect(paid.gold).toBe(questReward(5));
    expect(paid.character.gold).toBe(100 + questReward(5));
    expect(questState(paid.character, 'open-guard')).toBe('claimed');
    expect(claimQuest(paid.character, 'open-guard').gold).toBe(0);
    // a task not taken is not done by chance
    expect(questState(recordQuestBout(paid.character, { ...win, turns: 3 }).character, 'quick-work')).toBe('open');
  });

  it('checks the crowd and the number of the gladiator’s own actions', () => {
    const c = acceptQuest(acceptQuest(hero(), 'crowd-pleaser'), 'quick-work');
    expect(recordQuestBout(c, { ...win, favour: 80, turns: 8 }).completed.map((q) => q.id)).toEqual(['crowd-pleaser', 'quick-work']);
    expect(recordQuestBout(c, { ...win, favour: 79, turns: 9 }).completed).toEqual([]);
  });

  it('counts a bout from the core events: blocks and the gladiator’s turns', () => {
    let state = createCombat(3, { position: 4 }, { position: 6 });
    const events = [];
    for (const action of ['block', 'rest'] as const) {
      const r = performAction(state, action);
      events.push(...r.events);
      state = r.state;
      const e = performAction(state, 'rest');
      events.push(...e.events);
      state = e.state;
    }
    expect(tallyBout(state, events)).toEqual({ won: false, usedBlock: true, favour: state.fighters.player.crowd.favour, turns: 3 });
  });

  it('keeps the tavern in the save and rejects unknown tasks', () => {
    const c = acceptQuest(hero(), 'quick-work');
    const loaded = deserializeSave(serializeSave(c));
    expect(loaded.ok && loaded.character.tavern).toEqual({ accepted: ['quick-work'], completed: [], claimed: [], bets: 0 });
    const bad = serializeSave(c).replace('"quick-work"', '"slay-dragon"');
    expect(deserializeSave(bad).ok).toBe(false);
  });
});

describe('tavern rumours and bets (#65)', () => {
  it('gives two rumours a day, the darker ones only later in the story', () => {
    const heard = (patch: Partial<SavedCharacter>) => {
      const all = new Set<string>();
      for (let day = 1; day <= 40; day++) for (const r of tavernRumours(hero({ ...patch, story: { ...newStory(), ...patch.story, day } }))) all.add(r);
      return all;
    };
    expect(tavernRumours(hero())).toHaveLength(2);
    const early = heard({});
    const wins = Array.from({ length: 18 }, (_, i) => `bout${i}`);
    const late = heard({ leagueWins: wins, story: { ...newStory(), act: 2 } });
    expect(early.size).toBe(3);
    expect(late.size).toBeGreaterThan(early.size + 3);
    expect([...late].some((r) => r.includes('grey hood'))).toBe(true);
    expect([...early].some((r) => r.includes('grey hood'))).toBe(false);
  });

  it('shows the same card until a bet is placed, then a new pair', () => {
    const c = hero();
    expect(betCard(c)).toEqual(betCard(c));
    const card = betCard(c);
    expect(card.fighters.player.name).not.toBe(card.fighters.enemy.name);
    expect(fightBet(card)).toBe(fightBet(card));
    const bet = placeBet(c, 'player', 25);
    expect(bet.ok).toBe(true);
    if (!bet.ok) return;
    expect(bet.character.tavern?.bets).toBe(1);
    expect(betCard(bet.character)).not.toEqual(card);
    expect(bet.won).toBe(bet.winner === 'player');
    expect(bet.character.gold).toBe(100 - 25 + (bet.won ? Math.round(25 * card.fighters.player.odds) : 0));
  });

  it('refuses a stake not on the board or not in the purse', () => {
    expect(placeBet(hero(), 'enemy', 13)).toMatchObject({ ok: false, reason: 'invalid-stake' });
    expect(placeBet(hero({ gold: 20 }), 'enemy', BET_STAKES[1])).toMatchObject({ ok: false, reason: 'insufficient-gold' });
  });

  it('keeps a house edge: the two odds never pay back more than was staked on average', () => {
    for (let bets = 0; bets < 20; bets++) {
      const { player, enemy } = betCard(hero({ tavern: { accepted: [], completed: [], claimed: [], bets } })).fighters;
      expect(Math.min(player.odds, enemy.odds)).toBeGreaterThanOrEqual(1.2);
      expect(1 / player.odds + 1 / enemy.odds).toBeGreaterThan(1);
    }
  });
});

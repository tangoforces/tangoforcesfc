const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const loadStatsApi = () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/stats.js'), 'utf8');
  const sandbox = {
    console,
    window: { AppConfig: {}, db: null },
    document: {
      addEventListener: () => {},
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({
        appendChild: () => {},
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} }
      })
    },
    fetch: async () => ({ json: async () => [] }),
    setTimeout,
    clearTimeout
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(
    source + '\nthis.aggregateStatsFromMatches = aggregateStatsFromMatches; this.playerMatchesReference = playerMatchesReference;',
    sandbox
  );

  return sandbox;
};

test('aggregateStatsFromMatches keeps Nawaz totals from unrelated goal events', () => {
  const { aggregateStatsFromMatches, playerMatchesReference } = loadStatsApi();

  const player = { id: 1, name: 'Edrice Mujeyi', nickname: 'Nawaz' };

  assert.equal(playerMatchesReference(player, 'Alious Jamela'), false, 'Unrelated player names must not match Nawaz');
  assert.equal(playerMatchesReference(player, 'Edward Mapuranga'), false, 'Different players with shared letters must not match');
  assert.equal(playerMatchesReference(player, 'Nawaz'), true, 'The nickname should still match exactly');

  const players = [
    { id: 1, name: 'Edrice Mujeyi', nickname: 'Nawaz', goals: 49, assists: 6, position: 'Forward' },
    { id: 2, name: 'Alious Jamela', nickname: 'Bambo', goals: 1, assists: 6, position: 'Midfielder' },
    { id: 3, name: 'Edward Mapuranga', nickname: 'Dos', goals: 4, assists: 6, position: 'Midfielder' }
  ];

  const matches = [
    {
      status: 'completed',
      events: [
        { type: 'goal', player: 'Edrice Mujeyi', assist: 'Edward Mapuranga' },
        { type: 'goal', player: 'Alious Jamela', assist: 'Edrice Mujeyi' },
        { type: 'goal', player: 'Alious Jamela' }
      ]
    }
  ];

  const updated = aggregateStatsFromMatches(players, matches);
  const nawaz = updated.find(player => player.id === 1);

  assert.equal(nawaz.goals, 1, 'Nawaz should use the real match-card total instead of the stale saved value');
  assert.equal(nawaz.assists, 1, 'Nawaz should only receive assists recorded in the actual match events');
});

test('aggregateStatsFromMatches resets stale totals when the match list is the canonical source', () => {
  const { aggregateStatsFromMatches } = loadStatsApi();

  const players = [
    { id: 1, name: 'Edrice Mujeyi', nickname: 'Nawaz', goals: 49, assists: 6, position: 'Forward' },
    { id: 2, name: 'Alious Jamela', nickname: 'Bambo', goals: 4, assists: 2, position: 'Midfielder' }
  ];

  const matches = [
    {
      status: 'completed',
      events: [
        { type: 'goal', player: 'Alious Jamela' }
      ]
    }
  ];

  const updated = aggregateStatsFromMatches(players, matches);
  const nawaz = updated.find(player => player.id === 1);
  const bambo = updated.find(player => player.id === 2);

  assert.equal(nawaz.goals, 0, 'Players without a recorded match contribution should not keep stale saved totals when match data is present');
  assert.equal(nawaz.assists, 0, 'Players without a recorded assist should not keep stale saved totals when match data is present');
  assert.equal(bambo.goals, 1, 'Players with a recorded goal should be counted from the match feed');
});

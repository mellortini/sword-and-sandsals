import { expect, it, vi } from 'vitest';
import { dependencyNumbers, unblockIssues } from '../.github/scripts/unblock-issues.mjs';

const repository = { owner: 'owner', repo: 'repo' };

it('reads unique references only from the dependencies section', () => {
  const body = '## Cel\r\nWzmianka #9\r\n## Zależności\r\npo #1, po #2, po #1\r\n### Szczegóły\r\nstatystyki z #3\r\n## Koniec\r\n#4';
  expect(dependencyNumbers(body)).toEqual([1, 2, 3]);
  expect(dependencyNumbers('Wzmianka #1')).toEqual([]);
  expect(dependencyNumbers('## Zależności\nbrak')).toEqual([]);
});

it('only marks sample issues ready once all of their dependencies are closed', async () => {
  const candidates = [
    { number: 10, body: '## Zależności\npo #1; statystyki z #2' },
    { number: 11, body: '## Zależności\npo #1, po #3' },
    { number: 12, body: '## Zależności\npo #1, po #2' },
    { number: 13, body: '## Cel\npo #1' },
    { number: 14, body: '## Zależności\npo #99' },
    { number: 15, body: '## Zależności\npo #15' },
    { number: 16, body: '## Zależności\npo #1', pull_request: {} },
    { number: 17, body: '## Zależności\npo #4' },
  ];
  const listForRepo = vi.fn();
  const get = vi.fn(async ({ issue_number: number }) => {
    if (number === 99) throw Object.assign(new Error('Not found'), { status: 404 });
    if (number === 4) return { data: { state: 'closed', pull_request: {} } };
    return { data: { state: number < 3 ? 'closed' : 'open' } };
  });
  const addLabels = vi.fn();
  const removeLabel = vi.fn();
  const github = { paginate: vi.fn().mockResolvedValue(candidates), rest: { issues: { listForRepo, get, addLabels, removeLabel } } };

  await expect(unblockIssues(github, repository)).resolves.toEqual([10, 12]);
  expect(github.paginate).toHaveBeenCalledWith(listForRepo, { ...repository, state: 'open', labels: 'blocked', per_page: 100 });
  expect(get.mock.calls.filter(([args]) => args.issue_number === 1)).toHaveLength(1);
  expect(addLabels.mock.calls.map(([args]) => args)).toEqual([
    { ...repository, issue_number: 10, labels: ['ready'] },
    { ...repository, issue_number: 12, labels: ['ready'] },
  ]);
  expect(removeLabel.mock.calls.map(([args]) => args)).toEqual([
    { ...repository, issue_number: 10, name: 'blocked' },
    { ...repository, issue_number: 12, name: 'blocked' },
  ]);
});

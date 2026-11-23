const DEPENDENCY_HEADING = /^(#{1,6})[ \t]+Zależności[ \t]*#*[ \t]*$/iu;
const HEADING = /^(#{1,6})[ \t]+/;

export function dependencyNumbers(body = '') {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => DEPENDENCY_HEADING.test(line));
  if (start === -1) return [];

  const depth = lines[start].match(DEPENDENCY_HEADING)[1].length;
  const end = lines.findIndex((line, index) => {
    const match = line.match(HEADING);
    return index > start && match !== null && match[1].length <= depth;
  });
  const section = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
  const numbers = Array.from(section.matchAll(/#([1-9]\d*)\b/g), (match) => Number(match[1]));
  return [...new Set(numbers.filter(Number.isSafeInteger))];
}

export async function unblockIssues(github, repository) {
  const { listForRepo, get, addLabels, removeLabel } = github.rest.issues;
  const candidates = await github.paginate(listForRepo, {
    ...repository, state: 'open', labels: 'blocked', per_page: 100,
  });

  const status = new Map();
  function isClosed(number) {
    if (!status.has(number)) {
      const check = get({ ...repository, issue_number: number })
        .then(({ data }) => data.state === 'closed' && !data.pull_request)
        .catch((error) => {
          if (error.status === 404 || error.status === 410) return false;
          throw error;
        });
      status.set(number, check);
    }
    return status.get(number);
  }

  const unblocked = [];
  for (const issue of candidates) {
    if (issue.pull_request) continue;
    const dependencies = dependencyNumbers(issue.body ?? '');
    if (!dependencies.length || dependencies.includes(issue.number)) continue;

    const closed = await Promise.all(dependencies.map(isClosed));
    if (!closed.every(Boolean)) continue;

    const target = { ...repository, issue_number: issue.number };
    await addLabels({ ...target, labels: ['ready'] });
    try {
      await removeLabel({ ...target, name: 'blocked' });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    unblocked.push(issue.number);
  }
  return unblocked;
}

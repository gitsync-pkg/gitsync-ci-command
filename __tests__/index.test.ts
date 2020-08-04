import * as fs from 'fs';
import {logMessage, createRepo, runCommand} from '@gitsync/test';
import ci from '..';
import * as tmp from 'tmp-promise'

async function testService(before: Function, after: Function) {
  const source = await createRepo();

  const targetOrigin = await createRepo(true);
  const target = await createRepo();
  await target.run(['remote', 'add', 'origin', targetOrigin.dir]);

  await source.commitFile('.gitsync.json', JSON.stringify({
    repos: [
      {
        sourceDir: 'package-name',
        target: target.dir,
      }
    ]
  }));

  const from = await source.run(['rev-parse', 'HEAD']);
  await source.commitFile('package-name/test.txt');
  const to = await source.run(['rev-parse', 'HEAD']);

  await before(from, to);
  await runCommand(ci, source, {
    dir: 'package-name',
  });
  await after();

  const logs = await targetOrigin.run(['log']);
  expect(logs).toContain('add package-name/test.txt');
}

describe('ci-commit command', () => {
  test('run commit in Travis CI', async () => {
    await testService((from: string, to: string) => {
      process.env.TRAVIS_COMMIT_RANGE = from + '...' + to;
    }, () => {
      delete process.env.TRAVIS_COMMIT_RANGE;
    });
  });

  test('run commit in Github Actions', async () => {
    await testService(async (from: string) => {
      process.env.GITHUB_EVENT_PATH = (await tmp.file()).path;
      fs.writeFileSync(process.env.GITHUB_EVENT_PATH, `{"before":"${from}"}`);
    }, () => {
      delete process.env.GITHUB_EVENT_PATH;
    });
  });

  test('Can not find previous pushed commit', async () => {
    const source = await createRepo();

    await runCommand(ci, source, {
      dir: 'package-name',
    });

    expect(logMessage()).toContain('Can not find previous pushed commit.');
  });
});



import {CommandModule} from 'yargs';
import {Config} from '@gitsync/config';
import git from "git-cli-wrapper";
import log from "@gitsync/log";
import commit from '@gitsync/commit-command';
import push from '@gitsync/push-command';
import * as fs from 'fs';

let command: CommandModule = {
  handler: () => {
  }
};

command.command = 'ci';

command.describe = 'Sync the pushed commits and push to the relative repositories in Continuous Integration service.';

command.handler = async () => {
  const source = git('.');
  const config = new Config();

  const prev = await getPrev();
  if (!prev) {
    log.info('Can not find previous pushed commit.')
    return;
  }

  const result = await source.run(['diff', '--name-only', 'HEAD', prev]);
  log.info('Found changed files: \n' + result);

  const files = result.split("\n");
  const changedRepos = config.getReposByFiles(files);

  for (const repo of changedRepos) {
    await runCommand(commit, {
      sourceDir: repo.sourceDir,
      yes: true,
    });

    await runCommand(push, {
      sourceDir: repo.sourceDir,
    });
  }
}

async function getPrev() {
  // GitHub Actions
  if (process.env.GITHUB_EVENT_PATH) {
    let hash = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).before;
    if (hash === '0'.repeat(40)) {
      // When pushing a new branch, GitHub will return an invalid hash, so we replace it with the root hash
      hash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    }
    return hash;
  }

  // Travis
  if (process.env.TRAVIS_COMMIT_RANGE) {
    return process.env.TRAVIS_COMMIT_RANGE.split('...')[0];
  }

  return null;
}

async function runCommand(command: CommandModule, options: any) {
  await command.handler(options);
}

export default command;

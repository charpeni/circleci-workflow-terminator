const { send, json } = require('micro');
const fetch = require('node-fetch');

const flatten = array => [].concat.apply([], array);

const MAX_RETRIES = isNaN(process.env.MAX_RETRIES)
  ? 2
  : process.env.MAX_RETRIES;
const WAIT_TIME = isNaN(process.env.WAIT_TIME) ? 10000 : process.env.WAIT_TIME;
const CIRCLE_CI_ACTIVE_STATUS = [
  'running',
  'queued',
  'scheduled',
  'not_running',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const circleciApiEndpoint = (repo, url = '') => {
  const { CIRCLE_TOKEN } = process.env;

  if (!CIRCLE_TOKEN) {
    console.error('Environment variable CIRCLE_TOKEN is missing.');
  }

  return `https://circleci.com/api/v1.1/project/github/${repo}${url}?circle-token=${CIRCLE_TOKEN}`;
};

const checkIfCircleHaveCommit = async (repo, commit) => {
  const res = await fetch(circleciApiEndpoint(repo));
  const builds = await res.json();

  const isHavingCommit =
    builds &&
    builds.length > 0 &&
    builds.some(({ vcs_revision }) => vcs_revision === commit);

  return isHavingCommit ? builds : false;
};

const waitForCommitOnCircle = async (repo, commit, retryCount = 0) => {
  console.log(
    `Waiting for commit (${commit}) to show up on CircleCI.`,
    retryCount > 0 ? `(Retry ${retryCount})` : ''
  );
  const builds = await checkIfCircleHaveCommit(repo, commit);

  if (builds) {
    return builds;
  }

  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  await sleep(WAIT_TIME);
  return await waitForCommitOnCircle(repo, commit, retryCount + 1);
};

module.exports = async (req, res) => {
  const payload = await json(req);

  if (!payload || !payload.head_commit || !payload.repository) {
    return send(res, 400);
  }

  const headCommitSha = payload.head_commit.id;
  const repo = payload.repository.full_name;

  console.log(
    `Push event received with the following head commit SHA: ${headCommitSha}`
  );

  // Send 200 early to prevent timeout error from GitHub webhooks.
  if (req.headers.host.includes('github.com')) {
    send(res, 200);
  }

  const builds = await waitForCommitOnCircle(repo, headCommitSha);

  if (!builds) {
    console.log('The commit has not showed up on CircleCi.');
    return '';
  }

  const activeBuilds = builds.filter(
    ({ status, branch }) => branch && CIRCLE_CI_ACTIVE_STATUS.includes(status)
  );

  if (activeBuilds.length === 0) {
    console.log('Nothing to do here.');
    return '';
  }

  const branches = activeBuilds.reduce(
    (acc, build) => ({
      ...acc,
      [build.branch]: acc[build.branch]
        ? [...acc[build.branch], build]
        : [build],
    }),
    {}
  );

  const branchesAndWorkflows = Object.entries(branches).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value.reduce((acc, branch) => {
        const workflowId = branch.workflows.workflow_id;

        return {
          ...acc,
          [workflowId]: acc[workflowId]
            ? [...acc[workflowId], branch]
            : [branch],
        };
      }, {}),
    }),
    {}
  );

  return flatten(
    Object.values(branchesAndWorkflows).map(branch => {
      if (Object.keys(branch).length > 1) {
        const buildsToCancel = Object.values(branch).sort(
          (a, b) => new Date(a[0].author_date) - new Date(b[0].author_date)
        );

        buildsToCancel.pop();

        return flatten(buildsToCancel).map(({ build_num }) => {
          console.log(`Build #${build_num} will be canceled.`);
          fetch(circleciApiEndpoint(repo, `/${build_num}/cancel`), {
            method: 'POST',
          });
          return build_num;
        });
      }

      return [];
    })
  );
};

const micro = require('micro');
const fetch = require('node-fetch');

const MAX_TRY = 2;
const CIRCLE_CI_ACTIVE_STATUS = [
  'running',
  'queued',
  'scheduled',
  'not_running',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const circleciApiEndpoint = (url = '') => {
  const { CIRCLE_TOKEN, ORG, REPO } = process.env;

  if (!CIRCLE_TOKEN) {
    console.error('Environment variable CIRCLE_TOKEN is missing.');
  }

  if (!ORG) {
    console.error('Environment variable ORG is missing.');
  }

  if (!REPO) {
    console.error('Environment variable REPO is missing.');
  }

  return `https://circleci.com/api/v1.1/project/github/${ORG}/${REPO}${url}?circle-token=${CIRCLE_TOKEN}`;
};

const waitForCommitOnCircle = async (commit, tryCount = 0) => {
  console.log(
    `Waiting for commit (${commit}) to show up on CircleCI.`,
    tryCount > 0 ? `(Retry ${tryCount})` : ''
  );
  const builds = await checkIfCircleHaveCommit(commit);

  if (builds) {
    return builds;
  }

  if (tryCount >= MAX_TRY) {
    return false;
  }

  await sleep(10000);
  return await waitForCommitOnCircle(commit, tryCount + 1);
};

const checkIfCircleHaveCommit = async commit => {
  const res = await fetch(circleciApiEndpoint());
  const builds = await res.json();

  const isHavingCommit = builds.some(
    ({ vcs_revision }) => vcs_revision === commit
  );

  return isHavingCommit ? builds : false;
};

const server = micro(async (req, res) => {
  const payload = await micro.json(req);
  const headCommitSha = payload.head_commit.id;

  console.log(
    `Push event received with the following head commit SHA: ${headCommitSha}`
  );

  const builds = await waitForCommitOnCircle(headCommitSha);

  if (!builds) {
    console.log('The commit has not showed up on CircleCi.');
    return '';
  }

  const activeBuilds = builds.filter(({ status }) =>
    CIRCLE_CI_ACTIVE_STATUS.includes(status)
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

  Object.values(branchesAndWorkflows).map(branch => {
    if (Object.keys(branch).length > 1) {
      const buildsToCancel = Object.values(branch)
        .sort((a, b) => new Date(b[0].author_date) - new Date(a[0].author_date))
        .pop();

      buildsToCancel.map(async ({ build_num }) => {
        console.log(`Build #${build_num} will be canceled.`);
        return await fetch(circleciApiEndpoint(`/${build_num}/cancel`), {
          method: 'POST',
        });
      });
    }
  });

  return '';
});

server.listen(process.env.PORT || 3000);
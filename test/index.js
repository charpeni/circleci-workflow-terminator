const listen = require('test-listen');
const micro = require('micro');
const test = require('ava');
const got = require('got');
const nock = require('nock');

const REPO_FULL_NAME = 'charpeni/circleci-test';

const originalConsoleLog = console.log;

let url;

test.beforeEach(async () => {
  process.env.CIRCLE_TOKEN = 1234;
  process.env.MAX_RETRIES = 0;
  process.env.WAIT_TIME = 500;

  console.log = () => null;

  nock('https://circleci.com')
    .persist()
    .post(uri => uri.includes('cancel'))
    .reply(200, {});

  const service = micro(require('../'));
  url = await listen(service);
});

test.afterEach(async () => {
  console.log = originalConsoleLog;
});

test.serial('should return an error 400 on empty body', async t => {
  try {
    await got(url, {
      method: 'post',
      json: true,
      headers: { 'content-type': 'application/json' },
      body: {},
    });
  } catch (e) {
    t.is(e.statusCode, 400);
  }
});

test.serial('should do nothing', async t => {
  nock('https://circleci.com')
    .get(
      `/api/v1.1/project/github/${REPO_FULL_NAME}?circle-token=${
        process.env.CIRCLE_TOKEN
      }`
    )
    .reply(200, []);

  const res = await got(url, {
    method: 'post',
    json: true,
    headers: { 'content-type': 'application/json' },
    body: {
      head_commit: {
        id: '1',
      },
      repository: {
        full_name: REPO_FULL_NAME,
      },
    },
  });

  t.is(res.body.text, undefined);
});

test.serial('should cancel builds', async t => {
  nock('https://circleci.com')
    .get(
      `/api/v1.1/project/github/${REPO_FULL_NAME}?circle-token=${
        process.env.CIRCLE_TOKEN
      }`
    )
    .reply(200, [
      {
        build_num: 1,
        author_date: '2018-06-15T00:00:00Z',
        branch: 'patch-1',
        status: 'running',
        workflows: {
          workflow_id: 'a',
        },
        vcs_revision: '1',
        head_commit: {
          id: '1',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 2,
        author_date: '2018-06-15T00:00:00Z',
        branch: 'patch-1',
        status: 'running',
        workflows: {
          workflow_id: 'a',
        },
        vcs_revision: '1',
        head_commit: {
          id: '1',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 3,
        author_date: '2018-06-16T00:00:00Z',
        branch: 'patch-1',
        status: 'queued',
        workflows: {
          workflow_id: 'b',
        },
        vcs_revision: '2',
        head_commit: {
          id: '2',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 4,
        author_date: '2018-06-16T00:00:00Z',
        branch: 'patch-2',
        status: 'queued',
        workflows: {
          workflow_id: 'aa',
        },
        vcs_revision: 'aa',
        head_commit: {
          id: 'aa',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 5,
        author_date: '2018-06-17T00:00:00Z',
        branch: 'patch-1',
        status: 'queued',
        workflows: {
          workflow_id: 'c',
        },
        vcs_revision: '3',
        head_commit: {
          id: '3',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
    ]);

  const res = await got(url, {
    method: 'post',
    json: true,
    headers: { 'content-type': 'application/json' },
    body: {
      head_commit: {
        id: '1',
      },
      repository: {
        full_name: REPO_FULL_NAME,
      },
    },
  });

  t.deepEqual(res.body, [1, 2, 3]);
});

test.serial('should not cancel builds with null branch', async t => {
  nock('https://circleci.com')
    .get(
      `/api/v1.1/project/github/${REPO_FULL_NAME}?circle-token=${
        process.env.CIRCLE_TOKEN
      }`
    )
    .reply(200, [
      {
        build_num: 1,
        author_date: '2018-06-15T00:00:00Z',
        branch: null,
        status: 'running',
        workflows: {
          workflow_id: 'a',
        },
        vcs_revision: '1',
        head_commit: {
          id: '1',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 2,
        author_date: '2018-06-15T00:00:00Z',
        branch: null,
        status: 'running',
        workflows: {
          workflow_id: 'a',
        },
        vcs_revision: '1',
        head_commit: {
          id: '1',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 3,
        author_date: '2018-06-16T00:00:00Z',
        branch: null,
        status: 'queued',
        workflows: {
          workflow_id: 'b',
        },
        vcs_revision: '2',
        head_commit: {
          id: '2',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 4,
        author_date: '2018-06-16T00:00:00Z',
        branch: null,
        status: 'queued',
        workflows: {
          workflow_id: 'aa',
        },
        vcs_revision: 'aa',
        head_commit: {
          id: 'aa',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
      {
        build_num: 5,
        author_date: '2018-06-17T00:00:00Z',
        branch: null,
        status: 'queued',
        workflows: {
          workflow_id: 'c',
        },
        vcs_revision: '3',
        head_commit: {
          id: '3',
        },
        repository: {
          full_name: REPO_FULL_NAME,
        },
      },
    ]);

  const res = await got(url, {
    method: 'post',
    json: true,
    headers: { 'content-type': 'application/json' },
    body: {
      head_commit: {
        id: '1',
      },
      repository: {
        full_name: REPO_FULL_NAME,
      },
    },
  });

  t.is(res.body, '');
});

// Unit tests for scripts/self-heal.js. Uses Node's built-in test runner
// (node --test) so the self-heal watchdog doesn't need its own test
// framework dependency. Every test that exercises main() runs against a
// throwaway temp directory (via SELF_HEAL_TEST_ROOT) and a fully mocked
// global.fetch -- no real GitHub or Anthropic API calls, and no risk to
// the real scripts/ directory.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  WORKFLOW_TO_SCRIPT,
  isSyntacticallyValid,
  fetchFailedJobLog,
  main,
} = require('./self-heal.js');

const REPO_ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// WORKFLOW_TO_SCRIPT mapping -- guards against drift if a workflow or script
// gets renamed without updating this table (exactly the class of bug that
// would silently make the watchdog stop diagnosing a workflow).
// ---------------------------------------------------------------------------

test('WORKFLOW_TO_SCRIPT: every mapped script file exists', () => {
  for (const scriptRelPath of Object.values(WORKFLOW_TO_SCRIPT)) {
    const full = path.join(REPO_ROOT, scriptRelPath);
    assert.ok(fs.existsSync(full), `${scriptRelPath} does not exist`);
  }
});

test('WORKFLOW_TO_SCRIPT: every mapped workflow name matches a real workflow file', () => {
  const workflowsDir = path.join(REPO_ROOT, '.github', 'workflows');
  const ymlFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
  const ymlNames = ymlFiles.map((f) => {
    const contents = fs.readFileSync(path.join(workflowsDir, f), 'utf8');
    const match = contents.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  });

  for (const workflowName of Object.keys(WORKFLOW_TO_SCRIPT)) {
    assert.ok(
      ymlNames.includes(workflowName),
      `no workflow file has name: ${workflowName} (found: ${ymlNames.join(', ')})`
    );
  }
});

test('WORKFLOW_TO_SCRIPT: does not include itself (no self-triggering loop)', () => {
  const workflowsDir = path.join(REPO_ROOT, '.github', 'workflows');
  const selfHealYml = fs.readFileSync(path.join(workflowsDir, 'self-heal.yml'), 'utf8');
  const selfHealNameMatch = selfHealYml.match(/^name:\s*(.+)$/m);
  const selfHealName = selfHealNameMatch ? selfHealNameMatch[1].trim() : null;
  assert.ok(!(selfHealName in WORKFLOW_TO_SCRIPT), 'self-heal.yml must not watch itself');
});

// ---------------------------------------------------------------------------
// isSyntacticallyValid
// ---------------------------------------------------------------------------

test('isSyntacticallyValid: accepts valid JavaScript', () => {
  assert.equal(isSyntacticallyValid('function f() { return 1 + 1; }'), true);
  assert.equal(isSyntacticallyValid('const x = { a: 1, b: [1, 2, 3] };'), true);
});

test('isSyntacticallyValid: rejects garbage', () => {
  assert.equal(isSyntacticallyValid('function broken( {{{ not valid js !!!'), false);
  assert.equal(isSyntacticallyValid('const x = ;'), false);
});

test('isSyntacticallyValid: empty string is technically valid (no statements)', () => {
  assert.equal(isSyntacticallyValid(''), true);
});

// ---------------------------------------------------------------------------
// fetchFailedJobLog
// ---------------------------------------------------------------------------

test('fetchFailedJobLog: finds the failed job and follows the log redirect', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });

  const calls = [];
  global.fetch = async (url) => {
    calls.push(url.toString());
    if (url.toString().endsWith('/runs/123/jobs')) {
      return new Response(JSON.stringify({
        jobs: [
          { id: 1, conclusion: 'success' },
          { id: 2, conclusion: 'failure' },
        ],
      }), { status: 200 });
    }
    if (url.toString().endsWith('/jobs/2/logs')) {
      return new Response(null, { status: 302, headers: { Location: 'https://blob.example/log.txt' } });
    }
    if (url.toString() === 'https://blob.example/log.txt') {
      return new Response('the log content', { status: 200 });
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const log = await fetchFailedJobLog('owner', 'repo', '123', 'fake-token');
  assert.equal(log, 'the log content');
  assert.ok(calls.some((u) => u.endsWith('/jobs/2/logs')), 'should have fetched job 2 (the failed one), not job 1');
});

test('fetchFailedJobLog: throws a clear error when the jobs list call fails', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });

  global.fetch = async () => new Response('nope', { status: 500 });

  await assert.rejects(
    () => fetchFailedJobLog('owner', 'repo', '123', 'fake-token'),
    /Could not list jobs for run 123: 500/
  );
});

// ---------------------------------------------------------------------------
// main() -- integration tests against a throwaway temp root
// ---------------------------------------------------------------------------

function makeTempRepoRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-heal-test-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  const scriptRelPath = 'scripts/fetch-xg-data.js';
  const originalSource = "// fixture script\nconst MIN_EXPECTED_MATCHES = 200;\nmodule.exports = { MIN_EXPECTED_MATCHES };\n";
  fs.writeFileSync(path.join(dir, scriptRelPath), originalSource);
  return { dir, scriptRelPath, originalSource };
}

function mockAnthropicResponse(fakeResult) {
  return new Response(JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-4-8',
    content: [{ type: 'text', text: JSON.stringify(fakeResult) }],
    stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function withMockedGithubAndAnthropic(logText, anthropicResult) {
  return async (url) => {
    const u = url.toString();
    if (u.includes('api.github.com') && u.includes('/jobs') && !u.includes('/logs')) {
      return new Response(JSON.stringify({ jobs: [{ id: 1, conclusion: 'failure' }] }), { status: 200 });
    }
    if (u.includes('api.github.com') && u.includes('/logs')) {
      return new Response(null, { status: 302, headers: { Location: 'https://blob.example/log.txt' } });
    }
    if (u === 'https://blob.example/log.txt') {
      return new Response(logText, { status: 200 });
    }
    if (u.includes('api.anthropic.com')) {
      return mockAnthropicResponse(anthropicResult);
    }
    throw new Error('unexpected fetch: ' + u);
  };
}

function setupEnv(t, tempDir) {
  const outputPath = path.join(tempDir, 'github_output.txt');
  fs.writeFileSync(outputPath, '');
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  process.env.SELF_HEAL_TEST_ROOT = tempDir;
  process.env.GITHUB_OUTPUT = outputPath;
  process.env.FAILED_WORKFLOW_NAME = 'FPL xG/xA Data';
  process.env.FAILED_RUN_ID = '999999';
  process.env.REPO = 'bhaisbhai/game-buddy-pl';
  process.env.GITHUB_TOKEN = 'fake-gh-token';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';

  t.after(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  return outputPath;
}

function readOutputs(outputPath) {
  const raw = fs.readFileSync(outputPath, 'utf8');
  const outputs = {};
  const re = /(\w+)<<EOF\n([\s\S]*?)\nEOF\n/g;
  let m;
  while ((m = re.exec(raw))) outputs[m[1]] = m[2];
  return outputs;
}

test('main(): confident + valid patch writes the file and PR outputs', async (t) => {
  const { dir, scriptRelPath, originalSource } = makeTempRepoRoot();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputPath = setupEnv(t, dir);

  global.fetch = withMockedGithubAndAnthropic(
    'Error: Could not find/parse playersData -- page structure changed.',
    {
      diagnosis: 'The endpoint moved.',
      confident: true,
      fixed_source: originalSource.replace('200', '250'),
    }
  );

  await main();

  const newSource = fs.readFileSync(path.join(dir, scriptRelPath), 'utf8');
  assert.match(newSource, /250/, 'file on disk should reflect the patch');

  const outputs = readOutputs(outputPath);
  assert.equal(outputs.patched, 'true');
  assert.equal(outputs.script, scriptRelPath);
  assert.equal(outputs.branch_slug, 'fetch-xg-data');
  assert.ok(fs.existsSync('/tmp/self-heal-pr-body.md'), 'PR body file should be written');
  const prBody = fs.readFileSync('/tmp/self-heal-pr-body.md', 'utf8');
  assert.match(prBody, /The endpoint moved\./);
});

test('main(): low-confidence (transient) diagnosis skips the patch entirely', async (t) => {
  const { dir, scriptRelPath, originalSource } = makeTempRepoRoot();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputPath = setupEnv(t, dir);

  global.fetch = withMockedGithubAndAnthropic(
    'Error: Understat getLeagueData returned 503',
    {
      diagnosis: 'Looks like a transient 503, not structural.',
      confident: false,
      fixed_source: originalSource,
    }
  );

  await main();

  const untouchedSource = fs.readFileSync(path.join(dir, scriptRelPath), 'utf8');
  assert.equal(untouchedSource, originalSource, 'file must be untouched when not confident');

  const outputs = readOutputs(outputPath);
  assert.equal(outputs.patched, 'false');
  assert.equal(outputs.script, undefined, 'no PR metadata should be emitted');
});

test('main(): confident but syntactically invalid patch is rejected, not written', async (t) => {
  const { dir, scriptRelPath, originalSource } = makeTempRepoRoot();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputPath = setupEnv(t, dir);

  global.fetch = withMockedGithubAndAnthropic(
    'Error: Could not find/parse playersData',
    {
      diagnosis: 'Endpoint moved (fabricated for the test).',
      confident: true,
      fixed_source: 'function broken( {{{ not valid js !!!',
    }
  );

  await main();

  const untouchedSource = fs.readFileSync(path.join(dir, scriptRelPath), 'utf8');
  assert.equal(untouchedSource, originalSource, 'file must be untouched when the patch does not parse');

  const outputs = readOutputs(outputPath);
  assert.equal(outputs.patched, 'false');
});

test('main(): confident but no-op patch (identical to original) skips the PR', async (t) => {
  const { dir, scriptRelPath, originalSource } = makeTempRepoRoot();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputPath = setupEnv(t, dir);

  global.fetch = withMockedGithubAndAnthropic(
    'Error: some ambiguous failure',
    {
      diagnosis: 'Actually nothing needs to change.',
      confident: true,
      fixed_source: originalSource,
    }
  );

  await main();

  const outputs = readOutputs(outputPath);
  assert.equal(outputs.patched, 'false');
});

test('main(): unknown workflow name is skipped without error', async (t) => {
  const { dir } = makeTempRepoRoot();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputPath = setupEnv(t, dir);
  process.env.FAILED_WORKFLOW_NAME = 'Some Unrelated Workflow';

  global.fetch = async () => { throw new Error('should not fetch anything for an unmapped workflow'); };

  await main();

  const outputs = readOutputs(outputPath);
  assert.equal(outputs.patched, 'false');
});

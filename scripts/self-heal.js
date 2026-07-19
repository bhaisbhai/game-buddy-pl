// Watchdog for the scheduled scrapers (team news, TV picks, FPL prices,
// Understat xG/xA). All of them scrape third-party pages/APIs that can
// change shape without warning -- exactly what happened to fetch-xg-data.js
// when Understat quietly moved from an embedded JSON blob to a same-origin
// AJAX endpoint. Rather than that sitting broken until someone notices,
// this runs after any of those workflows fails: it pulls the failing job's
// log, hands it to Claude alongside the current script source, and asks for
// a root-cause diagnosis plus a corrected file. It never commits directly --
// it writes the patch to disk and a PR body to a temp file; the calling
// workflow (self-heal.yml) uses peter-evans/create-pull-request so a human
// reviews and merges before anything reaches main.
//
// Deliberately conservative: if the failure looks transient (timeout,
// momentary 5xx, rate limit) rather than structural, or the model's patch
// doesn't even parse as valid JS, no PR is opened -- a re-run is cheaper
// and safer than a low-confidence auto-patch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Anthropic = require('@anthropic-ai/sdk');

// Resolved fresh on every call (not cached at module-load time) so tests
// can point it at a throwaway temp dir via SELF_HEAL_TEST_ROOT, set *after*
// this module is first required, without ever touching the real scripts/
// directory.
function repoRoot() {
  return process.env.SELF_HEAL_TEST_ROOT || path.join(__dirname, '..');
}

// Workflow display name -> the script it runs. Keep in sync with the
// `name:` field in each .github/workflows/*.yml and its `run: node ...` step.
const WORKFLOW_TO_SCRIPT = {
  'Team News': 'scripts/fetch-team-news.js',
  'TV Picks Refresh': 'scripts/scrape-tv-picks.js',
  'FPL Price Watch': 'scripts/fetch-fpl-prices.js',
  'FPL xG/xA Data': 'scripts/fetch-xg-data.js',
};

const LOG_TAIL_CHARS = 8000;

function writeOutput(name, value) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
}

async function fetchFailedJobLog(owner, repo, runId, token) {
  const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
  const jobsRes = await fetch(jobsUrl, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'game-buddy-pl-self-heal', Accept: 'application/vnd.github+json' },
  });
  if (!jobsRes.ok) throw new Error(`Could not list jobs for run ${runId}: ${jobsRes.status}`);
  const jobs = (await jobsRes.json()).jobs || [];
  const failedJob = jobs.find((j) => j.conclusion === 'failure') || jobs[0];
  if (!failedJob) throw new Error(`No jobs found for run ${runId}`);

  const logUrl = `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${failedJob.id}/logs`;
  const logRes = await fetch(logUrl, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'game-buddy-pl-self-heal', Accept: 'application/vnd.github+json' },
    redirect: 'manual',
  });
  // GitHub 302s to a presigned blob URL; that URL rejects our Authorization
  // header, so follow it manually with a bare request instead of `redirect: 'follow'`.
  if (logRes.status >= 300 && logRes.status < 400) {
    const location = logRes.headers.get('location');
    const blobRes = await fetch(location);
    return blobRes.text();
  }
  if (!logRes.ok) throw new Error(`Could not fetch logs for job ${failedJob.id}: ${logRes.status}`);
  return logRes.text();
}

function isSyntacticallyValid(source) {
  try {
    new vm.Script(source, { filename: 'candidate.js' });
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const workflowName = process.env.FAILED_WORKFLOW_NAME;
  const runId = process.env.FAILED_RUN_ID;
  const [owner, repo] = (process.env.REPO || '').split('/');
  const githubToken = process.env.GITHUB_TOKEN;

  const scriptRelPath = WORKFLOW_TO_SCRIPT[workflowName];
  if (!scriptRelPath) {
    console.log(`No known script mapping for workflow "${workflowName}" -- skipping.`);
    writeOutput('patched', 'false');
    return;
  }

  console.log(`Diagnosing failure in "${workflowName}" (run ${runId}) -> ${scriptRelPath}`);

  const fullLog = await fetchFailedJobLog(owner, repo, runId, githubToken);
  const logTail = fullLog.slice(-LOG_TAIL_CHARS);
  const scriptPath = path.join(repoRoot(), scriptRelPath);
  const originalSource = fs.readFileSync(scriptPath, 'utf8');

  const client = new Anthropic();

  const schema = {
    type: 'object',
    properties: {
      diagnosis: {
        type: 'string',
        description: 'Root-cause analysis of the failure, in 2-5 sentences, grounded in specific evidence from the log.',
      },
      confident: {
        type: 'boolean',
        description: 'True only if the log shows clear evidence of a structural change (site redesign, endpoint moved, field renamed, response shape changed) that a code fix can address. False for anything that looks transient (timeout, one-off 5xx, rate limit, network blip) or where the evidence is inconclusive.',
      },
      fixed_source: {
        type: 'string',
        description: 'The complete corrected file, ready to overwrite the original verbatim. If confident is false, return the original source completely unchanged.',
      },
    },
    required: ['diagnosis', 'confident', 'fixed_source'],
    additionalProperties: false,
  };

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: `You are diagnosing a failed scheduled scraper inside a small, zero-database Node.js app. The app's whole architecture is: static HTML/JS front-end + Vercel serverless functions + scheduled GitHub Actions that scrape third-party pages/APIs and write static JSON files the front-end reads. There is no database and no server-side state -- keep any fix within that shape.

Ground rules for a fix:
- Preserve the script's existing fail-loud convention: on structurally broken output (page changed, near-zero matches, unexpected shape), it must exit non-zero and write NOTHING, rather than silently writing bad or empty data. Do not weaken or remove this safeguard.
- Preserve existing ID-anchoring / matching logic (matching records across two systems via a stable code or id, not fuzzy name matching) unless the log shows specifically that this logic is what broke.
- Make the minimal change that addresses the root cause shown in the log. Do not refactor, rename, or restructure unrelated code, and do not add features.
- Only set confident=true if the log gives clear, specific evidence of a structural change (a 404 on a previously-working URL, a "could not find/parse X" error indicating page structure changed, a field that no longer exists, an endpoint that moved). If the evidence instead points to something transient -- a timeout, a single 5xx, a network error with no sign of a permanent change -- set confident=false and return fixed_source identical to the original; a re-run is the right fix for those, not a patch.
- fixed_source must always be the complete file content, never a diff, snippet, or partial file.`,
    messages: [{
      role: 'user',
      content: `Workflow: ${workflowName}\nScript: ${scriptRelPath}\n\n--- Failure log (tail, ${logTail.length} chars) ---\n${logTail}\n\n--- Current source of ${scriptRelPath} ---\n${originalSource}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Model response had no text block to parse.');
  const result = JSON.parse(textBlock.text);

  console.log(`Diagnosis: ${result.diagnosis}`);
  console.log(`Confident: ${result.confident}`);

  if (!result.confident) {
    console.log('Not confident this is a structural break -- skipping PR. A re-run is likely sufficient.');
    writeOutput('patched', 'false');
    return;
  }

  if (result.fixed_source.trim() === originalSource.trim()) {
    console.log('Model returned confident=true but proposed no actual change -- skipping PR.');
    writeOutput('patched', 'false');
    return;
  }

  if (!isSyntacticallyValid(result.fixed_source)) {
    console.log('Proposed fixed_source does not parse as valid JavaScript -- refusing to apply, skipping PR.');
    writeOutput('patched', 'false');
    return;
  }

  fs.writeFileSync(scriptPath, result.fixed_source);

  const slug = path.basename(scriptRelPath, '.js');
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
  const prBody = `## Self-heal: ${workflowName}

This PR was opened automatically after [\`${workflowName}\` failed](${runUrl}).

### Diagnosis

${result.diagnosis}

### What changed

\`${scriptRelPath}\` was rewritten by Claude (Opus 4.8) based on the failure log above. The existing fail-loud safeguard (exit non-zero and write nothing on a structurally broken scrape) and ID-anchoring logic were preserved per its instructions, but **this is an AI-generated patch on a live scraper and has not been tested against the real target site from this environment -- review the diff carefully before merging**, and consider manually re-triggering the workflow on this branch once merged to confirm it actually recovers.

---
🤖 Opened by the self-heal workflow (\`scripts/self-heal.js\`).`;

  fs.writeFileSync('/tmp/self-heal-pr-body.md', prBody);

  writeOutput('patched', 'true');
  writeOutput('branch_slug', slug);
  writeOutput('script', scriptRelPath);
  writeOutput('title', `${workflowName} broke -- proposed fix for ${scriptRelPath}`);
}

module.exports = { WORKFLOW_TO_SCRIPT, isSyntacticallyValid, fetchFailedJobLog, main };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

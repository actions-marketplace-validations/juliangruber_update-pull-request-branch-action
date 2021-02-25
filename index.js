'use strict'

const core = require('@actions/core')
const { GitHub, context } = require('@actions/github')

const sleep = dt => new Promise(resolve => setTimeout(resolve, dt))

const main = async () => {
  const token = core.getInput('github_token')
  const number = core.getInput('number')
  const waitForPullRequestUpdated =
    core.getInput('waitForPullRequestUpdated') === 'true'

  const octokit = new GitHub(token)

  let numbers
  if (number) {
    numbers = [number]
  } else {
    const listRes = await octokit.pulls.list({
      ...context.repo,
      state: 'open'
    })
    numbers = listRes.data.map(pull => pull.number)
  }

  for (const number of numbers) {
    const res = await octokit.pulls.get({
      ...context.repo,
      pull_number: number
    })
    const oldSha = res.data.head.sha
    const prMergeable = res.data.mergeable
    const prMergeableState = res.data.mergeable_state

    // update pull request only if it's outdated and there are no conflicts
    if (prMergeable && prMergeableState === 'behind') {
      core.info(`Updating pull request ${number}`)

      await octokit.pulls.updateBranch({
        ...context.repo,
        pull_number: number,
        expected_head_sha: oldSha
      })

      if (waitForPullRequestUpdated) {
        while (true) {
          core.debug('sleep')
          await sleep(1000)

          const res = await octokit.pulls.get({
            ...context.repo,
            pull_number: number
          })

          if (res.data.head.sha !== oldSha) break
        }
      }
    } else {
      core.info(`Skipping ${prMergeableState} pull request ${number}`)
    }
  }
}

main().catch(err => core.setFailed(err.message))

import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'
import { cascadingBranchMerge } from './cascading-branch-merge.js'

export async function run() {
  const githubToken = core.getInput('github_token', { required: true })
  const mergeToken = core.getInput('merge_token')
  const prefixes = core.getInput('prefixes', { required: true }).split(/,\s?/)
  const refBranch = core.getInput('ref_branch', { required: true })

  core.info(`Prefixes: ${prefixes}`)
  core.info(`Ref Branch: ${refBranch}`)

  if (
    github.context.payload.pull_request &&
    github.context.payload.pull_request.merged
  ) {
    const owner = github.context.repo.owner
    const repo = github.context.repo.repo
    const octokit = new Octokit({
      auth: githubToken,
      baseUrl: github.context.apiUrl
    })
    const mergeOctokit =
      mergeToken !== ''
        ? new Octokit({ auth: mergeToken, baseUrl: github.context.apiUrl })
        : octokit

    core.info(`PR Number: ${github.context.payload.pull_request.number}`)
    core.info(`Head Branch: ${github.context.payload.pull_request.head.ref}`)
    core.info(`Base Branch: ${github.context.payload.pull_request.base.ref}`)

    const originalPullRequestTitle =
      github.context.payload.pull_request.title?.trim() || undefined

    let originalMergeCommitMessage: string | undefined
    const mergeCommitSha = github.context.payload.pull_request.merge_commit_sha

    if (mergeCommitSha) {
      try {
        const mergeCommit = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: mergeCommitSha
        })
        originalMergeCommitMessage = mergeCommit.data.commit.message
      } catch (error) {
        core.warning(
          `Could not fetch original merge commit message from ${mergeCommitSha}: ${error}`
        )
      }
    } else {
      core.warning(
        'No merge_commit_sha found on the pull request payload. Falling back to default merge commit message.'
      )
    }

    cascadingBranchMerge(
      prefixes,
      refBranch,
      github.context.payload.pull_request.head.ref,
      github.context.payload.pull_request.base.ref,
      owner,
      repo,
      octokit,
      mergeOctokit,
      github.context.payload.pull_request.number,
      github.context.actor,
      originalMergeCommitMessage,
      originalPullRequestTitle
    )
  }
}

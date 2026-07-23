import { jest } from '@jest/globals'
import * as core from '../__fixtures__/@actions/core.js'
import * as github from '../__fixtures__/@actions/github.js'
import * as octokit from '../__fixtures__/@octokit/rest.js'
import type { cascadingBranchMerge } from '../src/cascading-branch-merge.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)
jest.unstable_mockModule('@octokit/rest', async () => {
  class Octokit {
    constructor() {
      return octokit
    }
  }

  return {
    Octokit
  }
})

const cascadingBranchMergeMock = jest.fn<typeof cascadingBranchMerge>()

jest.unstable_mockModule('../src/cascading-branch-merge.js', async () => ({
  cascadingBranchMerge: cascadingBranchMergeMock
}))

const main = await import('../src/main.js')

describe('main', () => {
  beforeEach(() => {
    github.context.payload.pull_request.merged = true
    github.context.payload.pull_request.merge_commit_sha = 'abc123'

    octokit.rest.repos.getCommit.mockResolvedValue({
      data: {
        commit: {
          message: 'JIRA-123 Preserve this commit message\n\nAdditional context'
        }
      }
    } as any)

    core.getInput
      .mockReset()
      .mockReturnValueOnce('MY_EXAMPLE_TOKEN') // github_token
      .mockReturnValueOnce('MY_MERGE_TOKEN') // merge_token
      .mockReturnValueOnce('release/,hotfix/,feature/') // prefixes
      .mockReturnValueOnce('development') // ref_branch
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Calls cascading branch merge if the PR was merged', async () => {
    await main.run()

    expect(core.getInput).toHaveBeenCalledTimes(4)
    expect(cascadingBranchMergeMock).toHaveBeenCalledTimes(1)
    expect(octokit.rest.repos.getCommit).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      ref: 'abc123'
    })
    expect(cascadingBranchMergeMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(String),
      'JIRA-123 Preserve this commit message\n\nAdditional context',
      'Add test 3 to release notes - JIRA 1234'
    )
  })

  it('Does not create the merge Octokit instance', async () => {
    core.getInput
      .mockReset()
      .mockReturnValueOnce('MY_EXAMPLE_TOKEN') // github_token
      .mockReturnValueOnce('') // merge_token
      .mockReturnValueOnce('release/,hotfix/,feature/') // prefixes
      .mockReturnValueOnce('development') // ref_branch

    await main.run()

    expect(core.getInput).toHaveBeenCalledTimes(4)
    expect(cascadingBranchMergeMock).toHaveBeenCalledTimes(1)
  })

  it('Does nothing if the PR was not merged', async () => {
    github.context.payload.pull_request.merged = false

    await main.run()

    expect(core.getInput).toHaveBeenCalledTimes(4)
    expect(cascadingBranchMergeMock).not.toHaveBeenCalled()
  })

  it('Falls back if merge commit message cannot be fetched', async () => {
    octokit.rest.repos.getCommit.mockRejectedValue(new Error('not found'))

    await main.run()

    expect(cascadingBranchMergeMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(String),
      undefined,
      'Add test 3 to release notes - JIRA 1234'
    )
  })
})

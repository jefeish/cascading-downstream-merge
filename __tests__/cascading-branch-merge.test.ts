import { jest } from '@jest/globals'
import { RequestError } from '@octokit/request-error'
import { Endpoints } from '@octokit/types'
import * as core from '../__fixtures__/@actions/core.js'
import * as github from '../__fixtures__/@actions/github.js'
import * as octokit from '../__fixtures__/@octokit/rest.js'

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

const cascadingBranchMerge = await import('../src/cascading-branch-merge.js')

const { Octokit } = await import('@octokit/rest')
const mocktokit = jest.mocked(new Octokit())

describe('Cascading Branch Merge', () => {
  beforeEach(() => {
    mocktokit.paginate.mockReturnValue([
      { name: 'release/1.0' },
      { name: 'release/1.1-3' },
      { name: 'release/1.1-rc1' },
      { name: 'release/1.1-2' },
      { name: 'release/1.1' },
      { name: 'release/1.1-1' },
      { name: 'release/1.2-a' },
      { name: 'release/1.2-b' },
      { name: 'release/1.3' },
      { name: 'release/2.0' },
      { name: 'develop' }
    ] as any)

    mocktokit.rest.pulls.create.mockResolvedValue({
      data: { number: 1 }
    } as Endpoints['POST /repos/{owner}/{repo}/pulls']['response'])

    ;(mocktokit.rest.pulls.list as unknown as any).mockResolvedValue({
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/ActionsDesk/cascading-downstream-merge/pulls',
      data: []
    } as unknown as Endpoints['GET /repos/{owner}/{repo}/pulls']['response'])

    mocktokit.rest.issues.create.mockResolvedValue({
      data: { number: 1 }
    } as Endpoints['POST /repos/{owner}/{repo}/issues']['response'])
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Performs a simple cascade', async () => {
    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      github.context.actor,
      'JIRA-123 Preserve this\n\nAdditional details',
      'Add test 3 to release notes - JIRA 1234'
    )

    expect(mocktokit.paginate).toHaveBeenCalledWith(
      mocktokit.rest.repos.listBranches,
      {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
      }
    )

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(10)
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1',
      head: 'release/1.0',
      title: 'Automatic merge: Add test 3 to release notes - JIRA 1234',
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1-1',
      head: 'release/1.1',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(3, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1-2',
      head: 'release/1.1-1',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(4, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1-3',
      head: 'release/1.1-2',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(5, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1-rc1',
      head: 'release/1.1-3',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(6, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.2-a',
      head: 'release/1.1-rc1',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(7, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.2-b',
      head: 'release/1.2-a',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(8, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.3',
      head: 'release/1.2-b',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(9, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/2.0',
      head: 'release/1.3',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(10, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'develop',
      head: 'release/2.0',
      title: 'Automatic merge: Add test 3 to release notes - JIRA 1234',
      body: expect.anything()
    })

    expect(mocktokit.rest.pulls.merge).toHaveBeenNthCalledWith(1, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: 1,
      commit_title: 'JIRA-123 Preserve this',
      commit_message: 'Additional details'
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledTimes(11)
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':white_check_mark: Auto-merge was successful.'
    })

    expect(mocktokit.rest.issues.create).not.toHaveBeenCalled()
  })

  it('Fixing a conflict continues the cascade', async () => {
    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'release/1.2',
      'release/1.3',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      github.context.actor
    )

    expect(mocktokit.paginate).toHaveBeenCalledWith(
      mocktokit.rest.repos.listBranches,
      {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
      }
    )

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(2)
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/2.0',
      head: 'release/1.3',
      title: expect.anything(),
      body: expect.anything()
    })
    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'develop',
      head: 'release/2.0',
      title: expect.anything(),
      body: expect.anything()
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledTimes(3)
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':white_check_mark: Auto-merge was successful.'
    })

    expect(mocktokit.rest.issues.create).not.toHaveBeenCalled()
  })

  it('Adds a comment if there are no commits for a PR', async () => {
    const error = new RequestError('Validation Failed', 422, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/foo',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 422,
        url: 'https://api.github.com/foo',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message: 'Validation Failed',
          errors: [
            {
              message: 'No commits between develop and develop'
            }
          ]
        }
      }
    })

    mocktokit.rest.pulls.create.mockRejectedValue(error)
    ;(mocktokit.rest.pulls.list as unknown as any).mockResolvedValueOnce({
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/ActionsDesk/cascading-downstream-merge/pulls',
      data: [
        {
          number: 99,
          html_url:
            'https://github.com/ActionsDesk/cascading-downstream-merge/pull/99'
        }
      ]
    } as unknown as Endpoints['GET /repos/{owner}/{repo}/pulls']['response'])

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/2.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      github.context.actor
    )

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(1)
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.stringMatching(/.*There are no commits between.*/)
    })
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':white_check_mark: Auto-merge was successful.'
    })
    expect(mocktokit.rest.issues.create).not.toHaveBeenCalled()
  })

  it('Breaks if a PR already exists', async () => {
    const error = new RequestError('Validation Failed', 422, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/foo',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 422,
        url: 'https://api.github.com/foo',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message: 'Validation Failed',
          errors: [
            {
              message: 'A pull request already exists'
            }
          ]
        }
      }
    })

    mocktokit.rest.pulls.create.mockRejectedValue(error)
    ;(mocktokit.rest.pulls.list as unknown as any).mockResolvedValueOnce({
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/ActionsDesk/cascading-downstream-merge/pulls',
      data: [
        {
          number: 99,
          html_url:
            'https://github.com/ActionsDesk/cascading-downstream-merge/pull/99'
        }
      ]
    } as unknown as Endpoints['GET /repos/{owner}/{repo}/pulls']['response'])

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      github.context.actor
    )

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(1)
    expect(mocktokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      head: `${github.context.repo.owner}:release/1.0`,
      base: 'release/1.1'
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.stringMatching(
        /.*already a pull request open.*Existing PR: \[#99\]\(https:\/\/github.com\/ActionsDesk\/cascading-downstream-merge\/pull\/99\).*/s
      )
    })
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
    })

    expect(mocktokit.rest.issues.create).not.toHaveBeenCalled()
  })

  it('Opens an issue if an unhandled error occurs', async () => {
    const error = new RequestError('Validation Failed', 500, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/foo',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 500,
        url: 'https://api.github.com/foo',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message: 'Some Unhandled Error',
          errors: [
            {
              message: 'Unhandled Exception'
            }
          ]
        }
      }
    })

    mocktokit.rest.pulls.create.mockRejectedValue(error)

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      'handle'
    )

    expect(mocktokit.rest.issues.create).toHaveBeenCalledTimes(1)
    expect(mocktokit.rest.issues.create).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      assignees: ['handle'],
      title: expect.any(String),
      body: expect.stringMatching(/^Unknown issue when creating.*/)
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.stringMatching(/.*encountered an issue.*/)
    })
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
    })

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(1)
  })

  it('Adds a comment and breaks if a merge conflict exists', async () => {
    const error = new RequestError('Validation Failed', 405, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/merge',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 405,
        url: 'https://api.github.com/merge',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message: 'Merge conflict',
          errors: [
            {
              message: 'Merge conflict'
            }
          ]
        }
      }
    })

    mocktokit.rest.pulls.merge.mockRejectedValue(error)

    mocktokit.rest.pulls.create.mockResolvedValue({
      data: { number: 13 }
    } as Endpoints['POST /repos/{owner}/{repo}/pulls']['response'])

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.2',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      'handle'
    )

    expect(mocktokit.rest.issues.create).toHaveBeenCalledTimes(1)
    expect(mocktokit.rest.issues.create).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      assignees: ['handle'],
      title: expect.any(String),
      body: expect.stringMatching(
        /.*PR #13\..*### Error Details.*Please review and resolve the reported problem\./s
      )
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenNthCalledWith(2, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.stringMatching(
        /# ❗ Merge Conflict with Cascading Auto-Merge.*Issue with cascading auto-merge while merging PR \[#13\]\(https:\/\/github.com\/ActionsDesk\/cascading-downstream-merge\/pull\/13\)\..*Source branch: \*\*release\/2.0\*\*.*Target branch: \*\*develop\*\*.*\| Status \| Message \|.*\| 405 \| Merge conflict \|.*Please review and resolve the reported problem\..*Created an issue #1\./s
      )
    })
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
    })

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(1)

    expect(mocktokit.rest.pulls.merge).toHaveBeenCalledTimes(1)
  })

  it('Breaks if an unhandled error occurs merging a PR', async () => {
    const error = new RequestError('Validation Failed', 500, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/foo',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 500,
        url: 'https://api.github.com/foo',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message: 'Some Unhandled Error',
          errors: [
            {
              message: 'Unhandled Exception'
            }
          ]
        }
      }
    })

    mocktokit.rest.pulls.merge.mockRejectedValue(error)

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      'handle'
    )

    expect(mocktokit.rest.issues.create).toHaveBeenCalledTimes(1)
    expect(mocktokit.rest.issues.create).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      assignees: ['handle'],
      title: expect.any(String),
      body: expect.stringMatching(
        /^Issue with auto-merging a PR\..*### Error Details/s
      )
    })

    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.any(String)
    })
    expect(mocktokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
    })

    expect(mocktokit.rest.pulls.create).toHaveBeenCalledTimes(1)
  })

  it('Formats multiline API message readably in the PR comment table', async () => {
    const error = new RequestError('Method Not Allowed', 405, {
      request: {
        method: 'POST',
        url: 'https://api.github.com/merge',
        body: {
          bar: 'baz'
        },
        headers: {
          authorization: 'token secret13'
        }
      },
      response: {
        status: 405,
        url: 'https://api.github.com/merge',
        headers: {
          'x-github-request-id': '1:2:3:4'
        },
        data: {
          message:
            'Repository rule violations found\nAt least 1 approving review is required by reviewers with write access.',
          documentation_url:
            'https://docs.github.com/rest/pulls/pulls#merge-a-pull-request'
        }
      }
    })

    mocktokit.rest.pulls.merge.mockRejectedValue(error)

    mocktokit.rest.pulls.create.mockResolvedValue({
      data: { number: 14 }
    } as Endpoints['POST /repos/{owner}/{repo}/pulls']['response'])

    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.2',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      'handle'
    )

    expect(mocktokit.rest.issues.createComment).toHaveBeenNthCalledWith(2, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: 1,
      body: expect.stringMatching(
        /\| Status \| Message \|.*\| 405 \| Repository rule violations found<br>At least 1 approving review is required by reviewers with write access\. \|.*> Documentation: https:\/\/docs.github.com\/rest\/pulls\/pulls#merge-a-pull-request/s
      )
    })
  })

  it('Falls back to branch-based title if original PR title is missing', async () => {
    await cascadingBranchMerge.cascadingBranchMerge(
      ['release/'],
      'develop',
      'my-feature',
      'release/1.0',
      github.context.repo.owner,
      github.context.repo.repo,
      mocktokit,
      mocktokit,
      1,
      github.context.actor,
      undefined,
      undefined
    )

    expect(mocktokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: 'release/1.1',
      head: 'release/1.0',
      title: 'Automatic merge from release/1.0 -> release/1.1',
      body: expect.anything()
    })
  })
})

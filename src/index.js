const { checkMergability, getPullRequest } = require('./utilities')
const { cascadingBranchMerge } = require('./cascading-branch-merge')

const core = require('@actions/core');
const github = require('@actions/github');

/**
 * @description Entrypoint
 */
 async function exec() {

    try {
        const prefixes = core.getInput("prefixes")
        const refBranch = core.getInput("refBranch")
        const token = core.getInput("GITHUB_TOKEN")
        const octokit = github.getOctokit(token)
        const context = github.context
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        console.log('owner: ' + owner)
        console.log('repo: ' + repo)
        console.log('GITHUB_TOKEN: ' + token)
        console.log('prefixes: ' + prefixes)
        console.log('refBranch: ' + refBranch)
        console.log(checkMergability(1, 2))
        const res = await getPullRequest(1, owner, repo, octokit)
        console.log(res)

        // cascadingBranchMerge(
        //     prefixes,
        //     refBranch,
        //     headBranch,
        //     baseBranch,
        //     owner,
        //     repo,
        //     context,
        //     pullNumber
        // )
        
    } catch (e) {
        console.log(e)
    }
}

// Entrypoint
exec()
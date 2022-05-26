const { checkMergability } = require('./utilities')
const { cascadingBranchMerge } = require('./cascading-branch-merge')

const core = require('@actions/core');
const github = require('@actions/github');

/**
 * @description Entrypoint
 */
 async function exec() {

    try {
        const prefixes = core.getInput("prefixes")
        const token = core.getInput("GITHUB_TOKEN")
        const octokit = github.getOctokit(token)
        const context = github.context
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        console.log(' owner: ' + owner + '\n repo: ' + repo)
        console.log('GITHUB_TOKEN: ' + token)
        console.log(checkMergability(1, 2))

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
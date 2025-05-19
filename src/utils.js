import * as github from '@actions/github'
import * as core from '@actions/core'

export async function latestReleases() {
  const myToken = process.env.GITHUB_TOKEN
  if (!myToken) {
    throw new Error(
      'No GITHUB_TOKEN found; set GITHUB_TOKEN in your environment'
    )
  }
  const octokit = github.getOctokit(myToken)
  const releases = await octokit.rest.repos.listReleases({
    owner: 'fonttools',
    repo: 'fontspector',
    per_page: 100
  })
  if (releases.status !== 200) {
    throw new Error('Failed to get latest version')
  }

  // We're only interested in releases of the CLI
  return releases.data.filter((release) =>
    release.tag_name.startsWith('fontspector-v')
  )
}

export async function resolveVersion(version) {
  var releases = await latestReleases()
  if (version === 'latest' || !version) {
    core.info('Using latest version')
    return releases[0]
  }
  // Check if the wanted version is a valid version string
  const versionRegex = /^(\d+\.\d+\.\d+)$/
  const match = version.match(versionRegex)
  core.debug(`Wanted version: '${version}'`)
  if (!match) {
    throw new Error('Invalid version format. Use "X.Y.Z"')
  }
  // Narrow down cliReleases to the wanted version
  releases = releases.filter((release) =>
    release.tag_name.startsWith(`fontspector-v${version}`)
  )
  if (releases.length === 0) {
    throw new Error(
      `Version ${version} not found. Available versions: ${releases
        .map((release) => release.tag_name)
        .join(', ')}`
    )
  }
  return releases[0]
}

import * as github from '@actions/github'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'

function systemPair() {
  // Get the system pair for the current platform and architecture
  const platform = process.platform
  let arch = process.arch
  let newPlatform = ''
  if (platform === 'linux') {
    newPlatform = 'linux-gnu'
  } else if (platform === 'darwin') {
    newPlatform = 'apple-darwin'
    if (arch === 'arm64') {
      arch = 'aarch64'
    }
  } else if (platform === 'win32') {
    newPlatform = 'pc-windows-gnu'
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  return `${arch}-${newPlatform}`
}

export async function install(wantedVersion) {
  const myToken = process.env.GITHUB_TOKEN
  var octokit
  if (myToken) {
    octokit = github.getOctokit(myToken)
  } else {
    core.error('No GITHUB_TOKEN found')
  }
  const releases = await octokit.rest.repos.listReleases({
    owner: 'fonttools',
    repo: 'fontspector',
    per_page: 100
  })
  if (releases.status !== 200) {
    throw new Error('Failed to get latest version')
  }

  // We're only interested in releases of the CLI
  let cliReleases = releases.data.filter((release) =>
    release.tag_name.startsWith('fontspector-v')
  )

  if (wantedVersion && wantedVersion !== 'latest') {
    // Check if the wanted version is a valid version string
    const versionRegex = /^(\d+\.\d+\.\d+)$/
    const match = wantedVersion.match(versionRegex)
    core.debug(`Wanted version: '${wantedVersion}'`)
    if (!match) {
      throw new Error('Invalid version format. Use "X.Y.Z"')
    }
    // Narrow down cliReleases to the wanted version
    cliReleases = cliReleases.filter((release) =>
      release.tag_name.startsWith(`fontspector-v${wantedVersion}`)
    )
  }

  if (!cliReleases) {
    throw new Error(`No releases found for version ${wantedVersion}`)
  }

  let foundRelease = cliReleases[0]

  // Install the specified version of the tool
  core.info(`Installing ${foundRelease.name}...`)

  // Look for the asset with the name "fontspector-<platform>-<arch>.tar.gz"
  let relevantAssets = foundRelease.assets.filter(
    (asset) =>
      asset.name.startsWith('fontspector-') && asset.name.includes(systemPair())
  )
  if (relevantAssets.length === 0) {
    throw new Error(
      `No assets found for ${systemPair()}.\nAvailable assets: ${foundRelease.assets.map((asset) => asset.name).join(', ')}`
    )
  }
  // Get the first asset
  const asset = relevantAssets[0]
  core.info(`Downloading ${asset.name}...`)
  const downloadUrl = asset.browser_download_url
  core.debug(`Download URL: ${downloadUrl}`)
  const downloadPath = await tc.downloadTool(downloadUrl)
  const extractedPath =
    process.platform === 'win32'
      ? await tc.extractZip(downloadPath)
      : await tc.extractTar(downloadPath)
  const cachedPath = await tc.cacheDir(
    extractedPath,
    'fontspector',
    foundRelease.tag_name
  )
  core.addPath(cachedPath)
}

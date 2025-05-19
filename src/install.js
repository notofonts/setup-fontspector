import * as github from '@actions/github'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as path from 'path'
import * as fs from 'fs'
import { homedir } from 'os'
import { resolveVersion } from './utils'

const binDir = path.join(homedir(), '.fontspector', 'bin')

function systemPair() {
  // Get the system pair for the current platform and architecture
  const platform = process.platform
  let arch = process.arch
  let newPlatform = ''
  if (arch === 'x64') {
    arch = 'x86_64'
  } else if (arch === 'arm64') {
    arch = 'aarch64'
  }
  if (platform === 'linux') {
    newPlatform = 'unknown-linux-gnu'
  } else if (platform === 'darwin') {
    newPlatform = 'apple-darwin'
  } else if (platform === 'win32') {
    newPlatform = 'pc-windows-gnu'
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  return `${arch}-${newPlatform}`
}

export async function install(wantedVersion) {
  let foundRelease = await resolveVersion(wantedVersion)

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
  return installFromUrl(downloadUrl, foundRelease.tag_name)
}

async function installFromUrl(downloadUrl, tagname) {
  core.debug(`Download URL: ${downloadUrl}`)
  const downloadPath = await tc.downloadTool(downloadUrl)
  const extractedPath =
    process.platform === 'win32'
      ? await tc.extractZip(downloadPath)
      : await tc.extractTar(downloadPath)
  // Find binary inside path, move to binDir
  return installFromDirectory(extractedPath, tagname)
}

async function installFromDirectory(extractedPath, tagname) {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }
  const directories = fs
    .readdirSync(extractedPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
  const binDirName = directories[0]
  core.debug(`Binary directory name: ${binDirName}`)

  const extractedBinary = fs.readdirSync(path.join(extractedPath, binDirName))
  const binaryName = extractedBinary[0]
  core.debug(`Binary name: ${binaryName}`)

  const binaryPath = path.join(extractedPath, binDirName, binaryName)
  const newBinaryPath = path.join(binDir, binaryName)
  fs.copyFileSync(binaryPath, newBinaryPath)

  const cachedPath = await tc.cacheDir(binDir, 'fontspector', tagname)
  core.addPath(binDir)
}

export async function try_artifact() {
  const myToken = process.env.GITHUB_TOKEN
  if (!myToken) {
    throw new Error(
      'No GITHUB_TOKEN found; set GITHUB_TOKEN in your environment'
    )
  }
  const octokit = github.getOctokit(myToken)
  const artifacts = await octokit.rest.actions.listArtifactsForRepo({
    owner: 'fonttools',
    repo: 'fontspector',
    per_page: 100
  })
  let ourArtifact = artifacts.data.artifacts.filter(
    (asset) =>
      asset.name.startsWith('fontspector-') && asset.name.includes(systemPair())
  )
  if (ourArtifact.length === 0) {
    core.info(`No artifacts found for ${systemPair()}, building from source`)
    return false
  }
  core.info(`Found artifact ${ourArtifact[0].name}, downloading...`)
  let other_url = await octokit.rest.actions.downloadArtifact({
    owner: 'fonttools',
    repo: 'fontspector',
    artifact_id: ourArtifact[0].id,
    archive_format: 'zip'
  })
  // Gives redirect URL
  core.debug(`Artifact URL: ${other_url.url}`)
  //installFromUrl(other_url.url, ourArtifact[0].digest, 'zip')
  const downloadPath = await tc.downloadTool(other_url.url)
  // Rename to .zip
  fs.renameSync(downloadPath, downloadPath + '.zip')
  core.debug('Extracting ' + downloadPath + '.zip')
  let extractedPath = await tc.extractZip(downloadPath + '.zip')
  // Within there is a tar file, somewhere
  const extractedBinary = fs.readdirSync(extractedPath)
  const binaryName = path.join(extractedPath, extractedBinary[0])

  // Now extract tar of zip from there
  extractedPath =
    process.platform === 'win32'
      ? await tc.extractZip(binaryName)
      : await tc.extractTar(binaryName)
  // Find binary inside path, move to binDir
  await installFromDirectory(extractedPath, ourArtifact[0].digest)
  return true
}

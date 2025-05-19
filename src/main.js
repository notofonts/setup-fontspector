import * as core from '@actions/core'
import { build } from './build.js'
import { install, try_artifact } from './install.js'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  const version = core.getInput('version')
  const features = core.getInput('features')
  return _run(version, features)
}

// For tests
export async function _run(version, features) {
  try {
    // Are we doing a source build?
    var source_build = false
    if (version == 'head' && !features) {
      if (await try_artifact()) {
        return
      }
    }
    if (version == 'head' || features) {
      core.info('Building from source')
      source_build = true
      build(version, features)
    } else {
      core.info('Using prebuilt binaries')
      install(version)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

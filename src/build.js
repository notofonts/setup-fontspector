import * as core from '@actions/core'
import { exec } from 'child_process'

const REPO_URL = 'https://github.com/fonttools/fontspector'

export async function build(version, features) {
  // Let's make sure we have Rust
  const rustup = process.env.RUSTUP_HOME
  if (!rustup) {
    core.error('No RUSTUP_HOME found')
    core.setFailed(
      'No RUSTUP_HOME found; use actions-rust-lang/setup-rust-toolchain@v1 first'
    )
    return
  }

  let cargoCmd = 'cargo install '
  if (features) {
    cargoCmd += `--features "${features}" `
  }

  if (version == 'head') {
    cargoCmd += '--git ' + REPO_URL
  } else if (version == 'latest' || !version) {
    core.info('Using latest version')
    cargoCmd += 'fontspector'
  } else {
    cargoCmd += 'fontspector --version ' + version
  }

  core.info('Running ' + cargoCmd)
  exec(cargoCmd, (error, stdout, stderr) => {
    if (error) {
      core.error(`Error: ${error.message}`)
      return
    }
    if (stderr) {
      core.error(`stderr: ${stderr}`)
      return
    }
    core.debug(`stdout: ${stdout}`)
  })
}

import { spawn } from 'node:child_process'

const START_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const START_ARGS = ['run', 'start']
const START_MARKER = 'start electron app...'
const START_TIMEOUT_MS = 180000
const READY_GRACE_MS = 6000

let started = false
let settled = false
let readyTimer = null
let startTimeout = null

const child = spawn(START_COMMAND, START_ARGS, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    CI: process.env.CI ?? 'true'
  }
})

const cleanupTimers = () => {
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = null
  }

  if (startTimeout) {
    clearTimeout(startTimeout)
    startTimeout = null
  }
}

const finish = (code, message) => {
  if (settled) {
    return
  }

  settled = true
  cleanupTimers()

  if (child.exitCode === null && child.killed === false) {
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL')
      }
    }, 1500).unref()
  }

  if (message) {
    console.log(message)
  }

  process.exitCode = code
}

const handleChunk = (chunk) => {
  const text = chunk.toString()
  process.stdout.write(text)

  if (started || !text.includes(START_MARKER)) {
    return
  }

  started = true
  readyTimer = setTimeout(() => {
    finish(0, 'GUI smoke passed: Electron desktop shell stayed alive past startup.')
  }, READY_GRACE_MS)
}

child.stdout.on('data', handleChunk)
child.stderr.on('data', (chunk) => {
  const text = chunk.toString()
  process.stderr.write(text)
})

child.on('exit', (code, signal) => {
  if (settled) {
    return
  }

  if (started) {
    finish(
      1,
      `GUI smoke failed: Electron exited too early after startup (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
    )
    return
  }

  finish(
    1,
    `GUI smoke failed: Electron never reached startup marker (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
  )
})

startTimeout = setTimeout(() => {
  finish(1, 'GUI smoke failed: timed out while waiting for Electron desktop shell startup.')
}, START_TIMEOUT_MS)

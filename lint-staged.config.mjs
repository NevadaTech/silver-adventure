// Monorepo lint-staged: delegates ESLint to each workspace, runs Prettier at root.
// Each workspace owns its own eslint.config.mjs (Next-specific for front, Nest for brain).

const filterByPrefix = (files, prefix) =>
  files.filter((f) => f.startsWith(`${prefix}/`))

const stripPrefix = (files, prefix) =>
  files.map((f) => f.replace(new RegExp(`^${prefix}/`), ''))

export default {
  '**/*.{ts,tsx,js,jsx}': (files) => {
    const cmds = []

    const frontFiles = filterByPrefix(files, 'src/front')
    if (frontFiles.length > 0) {
      const relative = stripPrefix(frontFiles, 'src/front')
      cmds.push(`bun --cwd src/front exec eslint --fix ${relative.join(' ')}`)
    }

    const brainFiles = filterByPrefix(files, 'src/brain')
    if (brainFiles.length > 0) {
      const relative = stripPrefix(brainFiles, 'src/brain')
      cmds.push(`bun --cwd src/brain exec eslint --fix ${relative.join(' ')}`)
    }

    cmds.push(`prettier --write ${files.join(' ')}`)
    return cmds
  },
  '**/*.{json,md,css,mjs}': ['prettier --write'],
}

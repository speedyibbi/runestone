/**
 * Seeder script for creating test data
 *
 * This script:
 * 1. Signs up an account
 * 2. Creates a Codex
 * 3. Creates 10 root level runes
 * 4. Creates 2 directories
 * 5. Creates 3 runes in one directory and 2 in the other
 * 6. Creates a web of relations between runes
 * 7. Creates a disconnected web of 2-3 runes
 *
 * Usage: Import and call seed() function
 */

import { useSessionStore } from '@/stores/session'

interface RuneInfo {
  uuid: string
  title: string
}

/**
 * Main seeder function
 */
export async function seed(): Promise<void> {
  console.log('🌱 Starting seeder...')

  const sessionStore = useSessionStore()

  // Step 1: Sign up an account
  console.log('📝 Step 1: Signing up account...')
  const username = `default`
  const passphrase = '123'
  const userPassphrase = `${username}|${passphrase}`

  try {
    await sessionStore.setup(userPassphrase, 'signup')
    console.log('✅ Account created successfully')
  } catch (error) {
    console.error('❌ Failed to sign up:', error)
    throw error
  }

  // Step 2: Create a Codex
  console.log('📚 Step 2: Creating Codex...')
  let codexId: string
  try {
    codexId = await sessionStore.createCodex('Seeded Codex')
    console.log('✅ Codex created:', codexId)
  } catch (error) {
    console.error('❌ Failed to create Codex:', error)
    throw error
  }

  // Step 3: Open the Codex
  console.log('🔓 Step 3: Opening Codex...')
  try {
    await sessionStore.openCodex(codexId)
    console.log('✅ Codex opened')
  } catch (error) {
    console.error('❌ Failed to open Codex:', error)
    throw error
  }

  // Step 4: Create all runes first (so they exist for linking)
  console.log('📄 Step 4: Creating all runes...')

  // Create 10 root level runes
  const rootRunes: RuneInfo[] = []
  for (let i = 1; i <= 10; i++) {
    try {
      const title = `Root Rune ${i}`
      const content = `# ${title}\n\nThis is root rune number ${i}.`
      const uuid = await sessionStore.createRune(title, content)
      rootRunes.push({ uuid, title })
      console.log(`  ✅ Created: ${title}`)
    } catch (error) {
      console.error(`  ❌ Failed to create root rune ${i}:`, error)
      throw error
    }
  }

  // Create 2 directories
  const directories: RuneInfo[] = []
  for (let i = 1; i <= 2; i++) {
    try {
      const title = `Directory ${i}/`
      const uuid = await sessionStore.createRune(title, '')
      directories.push({ uuid, title })
      console.log(`  ✅ Created: ${title}`)
    } catch (error) {
      console.error(`  ❌ Failed to create directory ${i}:`, error)
      throw error
    }
  }

  // Create 3 runes in first directory and 2 in second
  const dir1Runes: RuneInfo[] = []
  const dir2Runes: RuneInfo[] = []

  // Create 3 runes in Directory 1
  for (let i = 1; i <= 3; i++) {
    try {
      const title = `${directories[0].title}Dir1 Rune ${i}`
      const content = `# Dir1 Rune ${i}\n\nThis is a rune in Directory 1.`
      const uuid = await sessionStore.createRune(title, content)
      dir1Runes.push({ uuid, title })
      console.log(`  ✅ Created: ${title}`)
    } catch (error) {
      console.error(`  ❌ Failed to create dir1 rune ${i}:`, error)
      throw error
    }
  }

  // Create 2 runes in Directory 2
  for (let i = 1; i <= 2; i++) {
    try {
      const title = `${directories[1].title}Dir2 Rune ${i}`
      const content = `# Dir2 Rune ${i}\n\nThis is a rune in Directory 2.`
      const uuid = await sessionStore.createRune(title, content)
      dir2Runes.push({ uuid, title })
      console.log(`  ✅ Created: ${title}`)
    } catch (error) {
      console.error(`  ❌ Failed to create dir2 rune ${i}:`, error)
      throw error
    }
  }

  // Create 3 disconnected runes
  const disconnectedRunes: RuneInfo[] = []
  for (let i = 1; i <= 3; i++) {
    try {
      const title = `Disconnected Rune ${i}`
      const content = `# ${title}\n\nThis rune is part of a disconnected web.`
      const uuid = await sessionStore.createRune(title, content)
      disconnectedRunes.push({ uuid, title })
      console.log(`  ✅ Created: ${title}`)
    } catch (error) {
      console.error(`  ❌ Failed to create disconnected rune ${i}:`, error)
      throw error
    }
  }

  // Step 5: Update rune contents with links to create relations
  console.log('🔗 Step 5: Adding relations via rune content...')

  // Update root runes with links (main web)
  const rootRuneContents = [
    // Root Rune 1 -> Root Rune 2, 3
    `# Root Rune 1\n\nThis is root rune number 1.\n\n## Related Runes\n\nSee also: [[Root Rune 2]]\nSee also: [[Root Rune 3]]`,
    // Root Rune 2 -> Root Rune 3, 4
    `# Root Rune 2\n\nThis is root rune number 2.\n\n## Related Runes\n\nSee also: [[Root Rune 3]]\nSee also: [[Root Rune 4]]`,
    // Root Rune 3 -> Root Rune 4, 5
    `# Root Rune 3\n\nThis is root rune number 3.\n\n## Related Runes\n\nSee also: [[Root Rune 4]]\nSee also: [[Root Rune 5]]`,
    // Root Rune 4 -> Root Rune 5, 6
    `# Root Rune 4\n\nThis is root rune number 4.\n\n## Related Runes\n\nSee also: [[Root Rune 5]]\nSee also: [[Root Rune 6]]`,
    // Root Rune 5 -> Root Rune 6, 7
    `# Root Rune 5\n\nThis is root rune number 5.\n\n## Related Runes\n\nSee also: [[Root Rune 6]]\nSee also: [[Root Rune 7]]`,
    // Root Rune 6 -> Root Rune 7, 8
    `# Root Rune 6\n\nThis is root rune number 6.\n\n## Related Runes\n\nSee also: [[Root Rune 7]]\nSee also: [[Root Rune 8]]`,
    // Root Rune 7 -> Root Rune 8, 9
    `# Root Rune 7\n\nThis is root rune number 7.\n\n## Related Runes\n\nSee also: [[Root Rune 8]]\nSee also: [[Root Rune 9]]`,
    // Root Rune 8 -> Root Rune 9, 10
    `# Root Rune 8\n\nThis is root rune number 8.\n\n## Related Runes\n\nSee also: [[Root Rune 9]]\nSee also: [[Root Rune 10]]`,
    // Root Rune 9 -> Root Rune 10, 1 (creates a cycle)
    `# Root Rune 9\n\nThis is root rune number 9.\n\n## Related Runes\n\nSee also: [[Root Rune 10]]\nSee also: [[Root Rune 1]]`,
    // Root Rune 10 -> Root Rune 1, 2
    `# Root Rune 10\n\nThis is root rune number 10.\n\n## Related Runes\n\nSee also: [[Root Rune 1]]\nSee also: [[Root Rune 2]]`,
  ]

  for (let i = 0; i < rootRunes.length; i++) {
    try {
      await sessionStore.updateRune(rootRunes[i].uuid, { content: rootRuneContents[i] })
      console.log(`  ✅ Updated ${rootRunes[i].title} with links`)
    } catch (error) {
      console.error(`  ❌ Failed to update ${rootRunes[i].title}:`, error)
      throw error
    }
  }

  // Update directory runes with links to root runes
  const dir1RuneContents = [
    // Dir1 Rune 1 -> Root Rune 1, 2
    `# Dir1 Rune 1\n\nThis is a rune in Directory 1.\n\n## Related Runes\n\nSee also: [[Root Rune 1]]\nSee also: [[Root Rune 2]]`,
    // Dir1 Rune 2 -> Root Rune 3, 4
    `# Dir1 Rune 2\n\nThis is a rune in Directory 1.\n\n## Related Runes\n\nSee also: [[Root Rune 3]]\nSee also: [[Root Rune 4]]`,
    // Dir1 Rune 3 -> Dir1 Rune 1, 2
    `# Dir1 Rune 3\n\nThis is a rune in Directory 1.\n\n## Related Runes\n\nSee also: [[Directory 1/Dir1 Rune 1]]\nSee also: [[Directory 1/Dir1 Rune 2]]`,
  ]

  for (let i = 0; i < dir1Runes.length; i++) {
    try {
      await sessionStore.updateRune(dir1Runes[i].uuid, { content: dir1RuneContents[i] })
      console.log(`  ✅ Updated ${dir1Runes[i].title} with links`)
    } catch (error) {
      console.error(`  ❌ Failed to update ${dir1Runes[i].title}:`, error)
      throw error
    }
  }

  const dir2RuneContents = [
    // Dir2 Rune 1 -> Root Rune 5, 6
    `# Dir2 Rune 1\n\nThis is a rune in Directory 2.\n\n## Related Runes\n\nSee also: [[Root Rune 5]]\nSee also: [[Root Rune 6]]`,
    // Dir2 Rune 2 -> Root Rune 7, 8
    `# Dir2 Rune 2\n\nThis is a rune in Directory 2.\n\n## Related Runes\n\nSee also: [[Root Rune 7]]\nSee also: [[Root Rune 8]]`,
  ]

  for (let i = 0; i < dir2Runes.length; i++) {
    try {
      await sessionStore.updateRune(dir2Runes[i].uuid, { content: dir2RuneContents[i] })
      console.log(`  ✅ Updated ${dir2Runes[i].title} with links`)
    } catch (error) {
      console.error(`  ❌ Failed to update ${dir2Runes[i].title}:`, error)
      throw error
    }
  }

  // Update disconnected runes with links only to each other
  const disconnectedRuneContents = [
    // Disconnected Rune 1 -> Disconnected Rune 2
    `# Disconnected Rune 1\n\nThis rune is part of a disconnected web.\n\n## Related Runes\n\nSee also: [[Disconnected Rune 2]]`,
    // Disconnected Rune 2 -> Disconnected Rune 3
    `# Disconnected Rune 2\n\nThis rune is part of a disconnected web.\n\n## Related Runes\n\nSee also: [[Disconnected Rune 3]]`,
    // Disconnected Rune 3 -> Disconnected Rune 1 (creates a cycle)
    `# Disconnected Rune 3\n\nThis rune is part of a disconnected web.\n\n## Related Runes\n\nSee also: [[Disconnected Rune 1]]`,
  ]

  for (let i = 0; i < disconnectedRunes.length; i++) {
    try {
      await sessionStore.updateRune(disconnectedRunes[i].uuid, {
        content: disconnectedRuneContents[i],
      })
      console.log(`  ✅ Updated ${disconnectedRunes[i].title} with links`)
    } catch (error) {
      console.error(`  ❌ Failed to update ${disconnectedRunes[i].title}:`, error)
      throw error
    }
  }

  sessionStore.teardown()

  console.log('✅ All relations created via rune content')

  console.log('🎉 Seeder completed successfully!')
  console.log(`📊 Summary:`)
  console.log(`   - Account: ${username}`)
  console.log(`   - Codex: ${codexId}`)
  console.log(`   - Root runes: ${rootRunes.length}`)
  console.log(`   - Directories: ${directories.length}`)
  console.log(`   - Directory 1 runes: ${dir1Runes.length}`)
  console.log(`   - Directory 2 runes: ${dir2Runes.length}`)
  console.log(`   - Disconnected runes: ${disconnectedRunes.length}`)
  console.log(
    `   - Total runes: ${rootRunes.length + dir1Runes.length + dir2Runes.length + disconnectedRunes.length + directories.length}`,
  )
}

/**
 * Export for use in browser console or other contexts
 */
if (typeof window !== 'undefined') {
  ;(window as any).seed = seed
}

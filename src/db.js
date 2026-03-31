import Dexie from 'dexie'

export const db = new Dexie('GymDiary')

db.version(1).stores({
  exercises: '++id, name, category',
  workouts: '++id, date',
  sets: '++id, workoutId, exerciseId',
})

db.version(2).stores({
  exercises: '++id, name, category',
  workouts: '++id, date',
  sets: '++id, workoutId, exerciseId',
  absolutePRs: '++id, exerciseName, category, achievedAt',
})

db.version(3).stores({
  exercises: '++id, name, category',
  workouts: '++id, date',
  sets: '++id, workoutId, exerciseId',
  absolutePRs: '++id, exerciseName, category, achievedAt',
  logs: '++id, timestamp, level, category',
})

const CORRECT_EXERCISES = [
  // Legs
  { name: 'Angler Leg Press',            category: 'Legs' },
  { name: 'Super Pendulum Squat',         category: 'Legs' },
  { name: 'Leg Press',                    category: 'Legs' },
  { name: 'Leg Extension',               category: 'Legs' },
  { name: 'Leg Extension One Leg',        category: 'Legs', unilateral: true },
  { name: 'Leg Curl',                     category: 'Legs' },
  { name: 'Prone Leg Curl',               category: 'Legs' },
  { name: 'Calf Raise',                   category: 'Legs' },
  // Back
  { name: 'Lat Pulldown',                 category: 'Back' },
  { name: 'Low Row',                      category: 'Back' },
  { name: 'Diverging Lat Pulldown',       category: 'Back' },
  { name: 'Diverging Low Row',            category: 'Back' },
  { name: 'Diverging Seated Row',         category: 'Back' },
  { name: 'Pullover Machine',             category: 'Back' },
  { name: 'Super High Row',               category: 'Back' },
  { name: 'T-Bar Row',                    category: 'Back' },
  // Chest
  { name: 'Converging Chest Press',       category: 'Chest' },
  { name: 'Peck Fly',                     category: 'Chest' },
  { name: 'Smith Machine Bench Press',    category: 'Chest' },
  { name: 'Smith Machine Incline Bench Press', category: 'Chest' },
  // Shoulders
  { name: 'Converging Shoulder Press',    category: 'Shoulders' },
  { name: 'Lateral Raise',               category: 'Shoulders' },
  { name: 'Viking Press',                 category: 'Shoulders' },
  { name: 'Rear Delt',                    category: 'Shoulders' },
  // Biceps
  { name: 'Biceps Curl',                  category: 'Biceps' },
  { name: 'Alternate Arm Curl',           category: 'Biceps', unilateral: true },
  // Triceps
  { name: 'Seated Dip',                   category: 'Triceps' },
  { name: 'French Press Machine',         category: 'Triceps' },
]

const CORRECT_NAMES = new Set(CORRECT_EXERCISES.map(e => e.name))

db.on('ready', async () => {
  try {
    const existing = await db.exercises.toArray()

    // Remove exercises not in the correct list
    const stale = existing.filter(e => !CORRECT_NAMES.has(e.name))

    // Compute adds and updates before touching the DB
    const existingByName = Object.fromEntries(existing.map(e => [e.name, e]))
    const missing = []
    const toUpdate = [] // { id, changes }
    for (const ce of CORRECT_EXERCISES) {
      const ex = existingByName[ce.name]
      if (!ex) {
        missing.push(ce)
      } else {
        const needsUpdate =
          ex.category !== ce.category ||
          Boolean(ex.unilateral) !== Boolean(ce.unilateral)
        if (needsUpdate) {
          toUpdate.push({ id: ex.id, changes: { category: ce.category, unilateral: ce.unilateral ?? false } })
        }
      }
    }

    // Batch all writes in a single transaction to avoid multiple round-trips
    // and reduce the chance of Safari IDB timing out mid-sequence
    if (stale.length || missing.length || toUpdate.length) {
      await db.transaction('rw', db.exercises, async () => {
        if (stale.length)   await db.exercises.bulkDelete(stale.map(e => e.id))
        if (missing.length) await db.exercises.bulkAdd(missing)
        for (const { id, changes } of toUpdate) {
          await db.exercises.update(id, changes)
        }
      })
    }
  } catch (err) {
    // Never let exercise reconciliation break the DB ready state.
    // Exercises will be reconciled on the next open.
    console.warn('[db] Exercise reconciliation failed:', err?.message ?? err)
  }
})

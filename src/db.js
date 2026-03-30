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
  { name: 'Alternate Arm Curl',           category: 'Biceps' },
  // Triceps
  { name: 'Seated Dip',                   category: 'Triceps' },
  { name: 'French Press Machine',         category: 'Triceps' },
]

const CORRECT_NAMES = new Set(CORRECT_EXERCISES.map(e => e.name))

db.on('ready', async () => {
  const existing = await db.exercises.toArray()

  // Remove exercises not in the correct list
  const stale = existing.filter(e => !CORRECT_NAMES.has(e.name))
  if (stale.length) {
    await db.exercises.bulkDelete(stale.map(e => e.id))
  }

  // Add exercises that are missing, and update fields (e.g. unilateral) on existing ones
  const existingByName = Object.fromEntries(existing.map(e => [e.name, e]))
  const missing = []
  for (const ce of CORRECT_EXERCISES) {
    const ex = existingByName[ce.name]
    if (!ex) {
      missing.push(ce)
    } else {
      // Update fields if they differ (e.g. unilateral flag added later)
      const needsUpdate =
        ex.category !== ce.category ||
        Boolean(ex.unilateral) !== Boolean(ce.unilateral)
      if (needsUpdate) {
        await db.exercises.update(ex.id, { category: ce.category, unilateral: ce.unilateral ?? false })
      }
    }
  }
  if (missing.length) {
    await db.exercises.bulkAdd(missing)
  }
})

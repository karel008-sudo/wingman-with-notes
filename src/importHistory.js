import { db } from './db'

function parseSets(str) {
  return str.split('-').map((part, idx) => {
    const match = part.match(/^(\d+(?:\.\d+)?)(?:\((\d+)\))?$/)
    if (!match) return { setNumber: idx + 1, weight: 0, reps: 10 }
    return {
      setNumber: idx + 1,
      weight: parseFloat(match[1]),
      reps: match[2] ? parseInt(match[2]) : 10,
    }
  })
}

// Name aliases: user's data name → seed name
const NAME_ALIASES = {
  'converging chess press': 'converging chest press',
}

// Each workout: date + max 7 exercises, grouped by muscle group.
// Rows assigned from most recent (last in original list) backwards.
const HISTORY = [
  {
    date: '2026-03-29',
    exercises: [
      { name: 'Angler Leg Press',    sets: '155-155-155-155' },
      { name: 'Super Pendulum Squat',sets: '100-105-105-105' },
      { name: 'Leg Press',           sets: '123-123-123-123' },
      { name: 'Leg Extension',       sets: '111-111-111-111' },
      { name: 'Leg Curl',            sets: '86-86-86-86' },
      { name: 'Prone Leg Curl',      sets: '54-54-54-54' },
      { name: 'Calf Raise',          sets: '60-60-60-60' },
    ],
  },
  {
    date: '2026-03-27',
    exercises: [
      { name: 'Lat Pulldown',           sets: '73-73-73-73' },
      { name: 'Low Row',                sets: '68-68-68-68' },
      { name: 'Diverging Lat Pulldown', sets: '97-97-97-97' },
      { name: 'Diverging Low Row',      sets: '111-111-111-111' },
      { name: 'Diverging Seated Row',   sets: '93-93-93-93' },
      { name: 'Pullover Machine',       sets: '80-80-80-80' },
      { name: 'T-Bar Row',              sets: '40-50-50-50' },
    ],
  },
  {
    date: '2026-03-25',
    exercises: [
      { name: 'Biceps Curl',              sets: '52-52-52-52' },
      { name: 'French Press Machine',     sets: '60-60-60-60' },
      { name: 'Alternate Arm Curl',       sets: '35-35-35-35' },
      { name: 'Seated Dip',               sets: '111-111-111-111' },
      { name: 'Peck Fly',                 sets: '77-77-77-79' },
      { name: 'Rear Delt',                sets: '73-73-73-73' },
      { name: 'Converging Shoulder Press',sets: '56-56-56-56' },
    ],
  },
  {
    date: '2026-03-23',
    exercises: [
      { name: 'Angler Leg Press',    sets: '150-155-155-155' },
      { name: 'Super Pendulum Squat',sets: '100-100-100-100' },
      { name: 'Leg Press',           sets: '114-123-123-123' },
      { name: 'Leg Extension',       sets: '111-111-111-111' },
      { name: 'Leg Curl',            sets: '82-86-86-86' },
      { name: 'Prone Leg Curl',      sets: '54-54-54-54' },
    ],
  },
  {
    date: '2026-03-21',
    exercises: [
      { name: 'Lat Pulldown',           sets: '73-73-73-73' },
      { name: 'Low Row',                sets: '68-68-68-68' },
      { name: 'Diverging Lat Pulldown', sets: '97-97-97-97' },
      { name: 'Diverging Low Row',      sets: '111-111-111-111' },
      { name: 'Diverging Seated Row',   sets: '93-93-93-93' },
      { name: 'Pullover Machine',       sets: '75-75-75-80' },
    ],
  },
  {
    date: '2026-03-19',
    exercises: [
      { name: 'Biceps Curl',              sets: '52-52-52-52' },
      { name: 'French Press Machine',     sets: '60-60-60-60' },
      { name: 'Alternate Arm Curl',       sets: '30-35-35-35' },
      { name: 'Seated Dip',               sets: '100-100-100-100' },
      { name: 'Peck Fly',                 sets: '70-73-73-77' },
      { name: 'Rear Delt',                sets: '70-73-73-73' },
      { name: 'Lateral Raise',            sets: '43-43-43-43' },
    ],
  },
  {
    date: '2026-03-17',
    exercises: [
      { name: 'Angler Leg Press',      sets: '150-150-150-150' },
      { name: 'Super Pendulum Squat',  sets: '90-100-100-100' },
      { name: 'Leg Press',             sets: '109-109-109-109' },
      { name: 'Leg Extension',         sets: '111-111-111-111' },
      { name: 'Leg Curl',              sets: '82-82-86-86' },
      { name: 'Prone Leg Curl',        sets: '54-54-54-54' },
      { name: 'Leg Extension One Leg', sets: '64-64-64-64' },
    ],
  },
  {
    date: '2026-03-15',
    exercises: [
      { name: 'Lat Pulldown',           sets: '73-73-73-73' },
      { name: 'Low Row',                sets: '68-68-68-68' },
      { name: 'Diverging Lat Pulldown', sets: '95-95-95-97' },
      { name: 'Diverging Low Row',      sets: '111-111-111-111' },
      { name: 'Diverging Seated Row',   sets: '91-91-91-93' },
      { name: 'Pullover Machine',       sets: '70-75-75-75' },
      { name: 'T-Bar Row',              sets: '40-40-40-40' },
    ],
  },
  {
    date: '2026-03-13',
    exercises: [
      { name: 'Biceps Curl',              sets: '52-52-52-52' },
      { name: 'French Press Machine',     sets: '55-60-60-60' },
      { name: 'Alternate Arm Curl',       sets: '25-30-30-30' },
      { name: 'Seated Dip',               sets: '100-100-100-100' },
      { name: 'Peck Fly',                 sets: '77-77-77-77' },
      { name: 'Rear Delt',                sets: '70-70-70-70' },
      { name: 'Converging Shoulder Press',sets: '56-56-56-56' },
    ],
  },
  {
    date: '2026-03-11',
    exercises: [
      { name: 'Angler Leg Press',    sets: '120-150-150-150' },
      { name: 'Super Pendulum Squat',sets: '80-90-90-90' },
      { name: 'Leg Press',           sets: '105-109-109-109' },
      { name: 'Leg Extension',       sets: '111-111-111-111' },
      { name: 'Leg Curl',            sets: '82-82-82-82' },
      { name: 'Prone Leg Curl',      sets: '54-54-54-54' },
    ],
  },
  {
    date: '2026-03-09',
    exercises: [
      { name: 'Lat Pulldown',           sets: '70-70-70-73' },
      { name: 'Low Row',                sets: '66-66-66-68' },
      { name: 'Diverging Lat Pulldown', sets: '95-95-95-97' },
      { name: 'Diverging Low Row',      sets: '111-111-111-111' },
      { name: 'Diverging Seated Row',   sets: '91-91-91-91' },
      { name: 'Pullover Machine',       sets: '70-70-70-70' },
      { name: 'Super High Row',         sets: '40-80-80-80' },
    ],
  },
  {
    date: '2026-03-07',
    exercises: [
      { name: 'Biceps Curl',              sets: '50-50-50-50' },
      { name: 'French Press Machine',     sets: '55-55-55-55' },
      { name: 'Seated Dip',               sets: '100-100-100-100' },
      { name: 'Rear Delt',                sets: '54-64-68-70' },
      { name: 'Lateral Raise',            sets: '43-43-43-43' },
      { name: 'Converging Shoulder Press',sets: '50-54-56-56' },
      { name: 'Converging Chess Press',   sets: '54-59-59-59' },
    ],
  },
  {
    date: '2026-03-05',
    exercises: [
      { name: 'Angler Leg Press',    sets: '120-150-150-150' },
      { name: 'Super Pendulum Squat',sets: '90-90-90-90' },
      { name: 'Leg Press',           sets: '100-100-100-100' },
      { name: 'Leg Extension',       sets: '109-111-111-111' },
      { name: 'Leg Curl',            sets: '86-86-82-82' },
      { name: 'Prone Leg Curl',      sets: '52-52-52-54' },
    ],
  },
  {
    date: '2026-03-03',
    exercises: [
      { name: 'Lat Pulldown',           sets: '70-70-70-70' },
      { name: 'Low Row',                sets: '64-66-66-66' },
      { name: 'Diverging Lat Pulldown', sets: '95-95-95-95' },
      { name: 'Diverging Low Row',      sets: '109-109-109-109' },
      { name: 'Diverging Seated Row',   sets: '82-86-91-91' },
      { name: 'Pullover Machine',       sets: '55-65-70-70' },
    ],
  },
  {
    date: '2026-03-01',
    exercises: [
      { name: 'Biceps Curl',              sets: '50-50-50-50' },
      { name: 'French Press Machine',     sets: '45-50-55-55' },
      { name: 'Seated Dip',               sets: '100-100-100-100' },
      { name: 'Lateral Raise',            sets: '43-43-43-43' },
      { name: 'Converging Shoulder Press',sets: '41-45-50-54' },
      { name: 'Converging Chess Press',   sets: '50-50-50-54' },
      { name: 'Peck Fly',                 sets: '61-68-73-77' },
    ],
  },
  {
    date: '2026-02-27',
    exercises: [
      { name: 'Angler Leg Press',    sets: '120-120-120-120' },
      { name: 'Super Pendulum Squat',sets: '70-90-90-90' },
      { name: 'Leg Extension',       sets: '109-109-109-109' },
      { name: 'Leg Curl',            sets: '82-82-86-86' },
      { name: 'Prone Leg Curl',      sets: '52-52-52-52' },
    ],
  },
  {
    date: '2026-02-25',
    exercises: [
      { name: 'Lat Pulldown',           sets: '59-68-68-68' },
      { name: 'Low Row',                sets: '59-64-64-64' },
      { name: 'Diverging Lat Pulldown', sets: '86-91-95-95' },
      { name: 'Diverging Low Row',      sets: '95-104-109-109' },
    ],
  },
  {
    date: '2026-02-23',
    exercises: [
      { name: 'Biceps Curl',                      sets: '47-47-50-50' },
      { name: 'French Press Machine',             sets: '30-35-40-40-45' },
      { name: 'Lateral Raise',                    sets: '41-41-41-41' },
      { name: 'Viking Press',                     sets: '40-40-40-40' },
      { name: 'Smith Machine Bench Press',        sets: '50-50-70-70' },
      { name: 'Smith Machine Incline Bench Press',sets: '30-50-50-50' },
      { name: 'Alternate Arm Curl',               sets: '20-20-20-20' },
    ],
  },
  {
    date: '2026-02-21',
    exercises: [
      { name: 'Angler Leg Press',sets: '120-150-170(8)-170(8)' },
      { name: 'Leg Curl',        sets: '82-82-86-86' },
      { name: 'Prone Leg Curl',  sets: '50-52-52-52' },
    ],
  },
  {
    date: '2026-02-19',
    exercises: [
      { name: 'Biceps Curl', sets: '45-45-45-45' },
    ],
  },
  {
    date: '2026-02-17',
    exercises: [
      { name: 'Leg Curl',      sets: '77-82-82-82' },
      { name: 'Prone Leg Curl',sets: '50-50-50-50' },
    ],
  },
]

export async function importHistory() {
  const exercises = await db.exercises.toArray()
  const byName = Object.fromEntries(
    exercises.map(e => [e.name.toLowerCase(), e])
  )

  const resolve = (name) => {
    const key = name.toLowerCase()
    return byName[NAME_ALIASES[key] ?? key] ?? null
  }

  for (const workout of HISTORY) {
    const workoutId = await db.workouts.add({ date: workout.date, note: '' })

    const allSets = workout.exercises.flatMap(ex => {
      const exercise = resolve(ex.name)
      if (!exercise) {
        console.warn('Exercise not found:', ex.name)
        return []
      }
      return parseSets(ex.sets).map(s => ({
        workoutId,
        exerciseId: exercise.id,
        ...s,
      }))
    })

    await db.sets.bulkAdd(allSets)
  }

  return HISTORY.length
}

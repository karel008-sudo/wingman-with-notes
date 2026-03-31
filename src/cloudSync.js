const SUPABASE_URL = 'https://mcdtbsffhusmrvbxumws.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZHRic2ZmaHVzbXJ2Ynh1bXdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODIyODEsImV4cCI6MjA5MDU1ODI4MX0.7UghqOj4uNopP2Pfc9tsgg6_T3PKebsrKFz-OPl4ygA'

const HEADERS = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates',
}

export async function cloudBackup(db) {
  try {
    const [workouts, sets, absolutePRs] = await Promise.all([
      db.workouts.toArray(),
      db.sets.toArray(),
      db.absolutePRs.toArray(),
    ])
    const data = { workouts, sets, absolutePRs, savedAt: new Date().toISOString() }

    await fetch(`${SUPABASE_URL}/rest/v1/backup`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ id: 'main', data, updated_at: new Date().toISOString() }),
    })
  } catch (err) {
    console.warn('[cloudSync] Backup failed:', err.message)
  }
}

export async function cloudRestore(db) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup?id=eq.main&select=data`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
    })
    if (!res.ok) return false

    const rows = await res.json()
    if (!rows.length) return false

    const { workouts, sets, absolutePRs } = rows[0].data
    if (!workouts?.length && !sets?.length) return false

    await db.transaction('rw', db.workouts, db.sets, db.absolutePRs, async () => {
      if (workouts?.length)    await db.workouts.bulkPut(workouts)
      if (sets?.length)        await db.sets.bulkPut(sets)
      if (absolutePRs?.length) await db.absolutePRs.bulkPut(absolutePRs)
    })
    return true
  } catch (err) {
    console.warn('[cloudSync] Restore failed:', err.message)
    return false
  }
}

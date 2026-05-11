import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const maxDuration = 60

function runPythonScript(filePath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), 'scripts', 'analyze_audio.py')
    const proc = spawn('python3', [scriptPath, filePath])

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => { stdout += chunk })
    proc.stderr.on('data', (chunk) => { stderr += chunk })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`Failed to parse Python output: ${stdout}`))
      }
    })

    proc.on('error', reject)
  })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audioFile = formData.get('audio') as Blob | null

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  const tmpPath = join('/tmp', `voice-${randomUUID()}.webm`)

  try {
    const buffer = Buffer.from(await audioFile.arrayBuffer())
    await writeFile(tmpPath, buffer)

    const features = await runPythonScript(tmpPath)
    return NextResponse.json({ features })
  } catch (err) {
    console.error('Audio feature extraction error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

import { readFileSync, writeFileSync } from 'fs'

const path = 'src/components/MessageList.tsx'
let c = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const lines = c.split('\n')

const s39 = ' '.repeat(39)
const s41 = ' '.repeat(41)

const newLines = [
  `${s39}className={\`relative \${(isOwn || downloadedIds.has(message.id)) && message.status !== 'sending' ? 'cursor-pointer' : ''}\`}`,
  `${s39}onPointerDown={(e) => e.stopPropagation()}`,
  `${s39}onClick={(e) => {`,
  `${s41}e.preventDefault()`,
  `${s41}e.stopPropagation()`,
  `${s41}if ((isOwn || downloadedIds.has(message.id)) && message.status !== 'sending') {`,
  `${s41}  setVideoPlayer(message.media_url!)`,
  `${s41}}`,
  `${s39}}}`,
]

// Target index 509 is the className line
const targetIndex = 509
console.log('Line 509: ', JSON.stringify(lines[targetIndex]))

if (!lines[targetIndex].includes('className={`relative')) {
  console.error('❌ Mismatch')
  process.exit(1)
}

// Replace the 10 lines from 509 through 518 (inclusive) with 9 lines
lines.splice(targetIndex, 10, ...newLines)

c = lines.join('\n').replace(/\n/g, '\r\n')
writeFileSync(path, c, 'utf8')
console.log('✅ Reverted capture click handlers')

import { readFileSync, writeFileSync } from 'fs'

const path = 'src/components/MessageList.tsx'
let c = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const lines = c.split('\n')

const s39 = ' '.repeat(39)
const s41 = ' '.repeat(41)
const s43 = ' '.repeat(43)

// Looking for the play button overlay code
// 527:                                    {/* Play button overlay */}
// 528:                                    {(isOwn || downloadedIds.has(message.id)) && message.status !== 'sending' && (
// 529:                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/20 transition-all">
// 530:                                        <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl group-hover/media:scale-110 transition-transform duration-200">
// 531:                                          <PlayCircle className="w-8 h-8 text-white" />
// 532:                                        </div>
// 533:                                      </div>
// 534:                                    )}

const targetIndex = 527
console.log('Line 527: ', JSON.stringify(lines[targetIndex]))

if (!lines[targetIndex].includes('Play button overlay')) {
  console.error('❌ Mismatch')
  process.exit(1)
}

const newOverlay = [
  `${s39}{/* Play button overlay (handles clicks to avoid native video swallowing touch) */}`,
  `${s39}{(isOwn || downloadedIds.has(message.id)) && message.status !== 'sending' && (`,
  `${s41}<div `,
  `${s43}className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-all cursor-pointer"`,
  `${s43}onPointerDown={(e) => e.stopPropagation()}`,
  `${s43}onClick={(e) => {`,
  `${s45}e.preventDefault()`,
  `${s45}e.stopPropagation()`,
  `${s45}setVideoPlayer(message.media_url!)`,
  `${s43}}}`,
  `${s41}>`,
  `${s43}<div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl transition-transform duration-200">`,
  `${s45}<PlayCircle className="w-8 h-8 text-white" />`,
  `${s43}</div>`,
  `${s41}</div>`,
  `${s39})}`,
]

// Replace 8 lines
lines.splice(targetIndex, 8, ...newOverlay)

c = lines.join('\n').replace(/\n/g, '\r\n')
writeFileSync(path, c, 'utf8')
console.log('✅ Added robust overlay button for video playback')
